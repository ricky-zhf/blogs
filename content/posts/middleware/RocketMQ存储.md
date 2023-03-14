---
title: "rocketmq存储设计"
date: 2023-02-11
lastmod: "2023-02-23"
author: "ricky"
summary: "rocketmq存储设计" #摘要
tags: ["mq"]
categories: ["middleware"]
autonumber: true
---

## ConsumeQueue

Consumer端订阅消息是需要通过ConsumeQueue这个消息消费的逻辑队列拿到一个索引，然后再从CommitLog里面读取真正的消息实体内容。RocketMQ 通过**使用在一个 `Topic` 中配置多个队列并且每个队列维护每个消费者组的消费位置** 实现了 **主题模式/发布订阅模式**

队列是消息队列中消息存储和传输的实际容器，也是消息队列RocketMQ版消息的最小存储单元。所有主题都是由多个队列组成，以此实现队列数量的水平拆分和队列内部的流式存储。生产者指定某个主题，向主题内发送消息，但实际消息发送到该主题下的某个队列中。消息队列RocketMQ版中通过修改队列数量，以此实现横向的水平扩容和缩容。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211022152250.png" alt="img" style="zoom:67%;" />

消息存储架构图中主要有下面三个跟消息存储相关的文件构成。

- CommitLog：消息主体以及元数据的存储主体；
- ConsumerQueue：消息消费索引，引入的目的主要是提高消息消费的性能。由于RocketMQ是基于主题topic的订阅模式，消息消费是针对主题进行的，如果要遍历commitlog文件，根据topic检索消息是非常低效的。Consumer可根据ConsumeQueue来查找待消费的消息。其中，ConsumeQueue作为消费消息的索引，保存了指定Topic下的队列消息在CommitLog中的起始物理偏移量offset，消息大小size和消息Tag的HashCode值；
- IndexFile：IndexFile（索引文件）提供了一种可以通过key或时间区间来查询消息的方法。

在上面的RocketMQ的消息存储整体架构图中可以看出，RocketMQ采用的是混合型的存储结构：

- 即为Broker单个实例下所有的队列共用一个日志数据文件（即为CommitLog）来存储。
- RocketMQ的混合型存储结构(多个Topic的消息实体内容都存储于一个CommitLog中)针对Producer和Consumer分别采用了数据和索引部分相分离的存储结构，Producer发送消息至Broker端，然后Broker端使用同步或者异步的方式对消息刷盘持久化，保存至CommitLog中。只要消息被刷盘持久化至磁盘文件CommitLog中，那么Producer发送的消息就不会丢失。正因为如此，Consumer也就肯定有机会去消费这条消息。当无法拉取到消息后，可以等下一次消息拉取，同时服务端也支持长轮询模式，如果一个消息拉取请求未拉取到消息，Broker允许等待30s的时间，只要这段时间内有新消息到达，将直接返回给消费端。这里RocketMQ的具体做法是，使用Broker端的后台服务线程—ReputMessageService不停地分发请求并异步构建ConsumeQueue（逻辑消费队列）和IndexFile（索引文件）数据。

## Consumer和Queue

Consumer和queue会优先平均分配，

如果Consumer少于queue的个数，则会存在部分Consumer消费多个queue的情况。

如果Consumer等于queue的个数，那就是一个Consumer消费一个queue。

如果Consumer个数大于queue的个数，那么会有部分Consumer空余出来，白白的浪费了。

## Offset

### Min/Max Offset

消息队列RocketMQ版定义队列中最早一条消息的位点为最小消息位点（MinOffset）；最新一条消息的位点为最大消息位点（MaxOffset）。虽然消息队列逻辑上是无限存储，但由于服务端物理节点的存储空间有限，消息队列RocketMQ版会滚动删除队列中存储最早的消息。因此，消息的最小消费位点和最大消费位点会一直递增变化。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211031640966.png" alt="消费位点更新" style="zoom: 50%;" />

### Consumer Offset

消息队列RocketMQ版领域模型为发布订阅模式，每个主题的队列都可以被多个消费者分组订阅。若某条消息被某个消费者消费后直接被删除，则其他订阅了该主题的消费者将无法消费该消息。因此，消息队列RocketMQ版通过消费位点管理消息的消费进度。每条消息被某个消费者消费完成后不会立即在队列中删除，消息队会基于每个消费者分组在每个队列上维护一份消费记录，该记录指定消费者分组消费该队列时，消费过的最新一条消息的位点，即消费位点。

当消费者客户端离线，又再次重新上线时，会严格按照服务端保存的消费进度继续处理消息。如果服务端保存的历史位点信息已过期被删除，此时消费位点向前移动至服务端存储的最小位点。

在RocketMQ 中，所有消息队列都是持久化，长度无限的数据结构，所谓长度无限是指队列中的每个存储单元都是定长，访问其中的存储单元使用Offset 来访问，Offset 为 java long 类型，64 位，理论上在 100年内不会溢出，所以认为是长度无限。也可以认为 Message Queue 是一个长度无限的数组，Offset 就是下标。
									<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211021706584.png" alt="消息模型" style="zoom: 67%;" />

一个主题存在多个队列，生产者每次生产消息后向指定主题中的某个队列发送消息。在集群消费模式下，一个消费者集群的多个消费者共同消费一个Topic的多个队列，一个队列只会被一个消费者消费，如果某个消费者挂掉，分组内其它消费者会接替挂掉的消费者继续消费。一般来讲要控制消费者组中的消费者个数和主题中队列个数相同 ，当然也可以消费者个数小于队列个数，只不过不太建议。

在发布订阅模式中一般会涉及到多个消费者组，而每个消费者组在每个队列中的消费位置都是不同的。如果此时有多个消费者组，那么消息被一个消费者组消费完之后是不会删除的（因为一个Topic可以被多个消费者订阅，那么其它消费者组也需要），它仅仅是为每个消费者组维护一个 消费位移(offset) ，每次消费者组消费完会返回一个成功的响应，然后队列再把维护的消费位移加一，这样就不会出现刚刚消费过的消息再一次被消费了。

简而言之就是：

- 每个消费者**组**消费Topic下的所有队列，该组中每个消费者可以消费多个消息队列，但是每个消息队列同一时间只能被同一消费组内的一个消费者消费；
- 

> Consumer Offset初始值

消费位点初始值指的是消费者分组首次启动消费者消费消息时，服务端保存的消费位点的初始值。

消息队列RocketMQ版定义消费位点的初始值为消费者首次获取消息时，该时刻队列中的最大消息位点。相当于消费者将从队列中最新的消息开始消费。

## 先总结下

- 一个Broker里有一个CommitLog；
- 一个CommitLog里可以存多个Topic的消息；
- 一个Topic可以有多个consumer queue。一个topic可以对应多个消费者组，反之亦然；
- 同一条队列可以被不同消费者组的消费者消费。同样，消费者也可以消费不同topic的下的队列

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202302052230792.png" alt="image-20230205223031771" style="zoom:80%;" />



## 页存储和内存映射

页缓存（PageCache)是OS对文件的缓存，用于加速对文件的读写。一般来说，程序对文件进行顺序读写的速度几乎接近于内存的读写速度，主要原因就是由于OS使用PageCache机制对读写访问操作进行了性能优化，将一部分的内存用作PageCache。对于数据的写入，OS会先写入至Cache内，随后通过异步的方式由pdflush内核线程将Cache内的数据刷盘至物理磁盘上。对于数据的读取，如果一次读取文件时出现未命中PageCache的情况，OS从物理磁盘上访问读取文件的同时，会顺序对其他相邻块的数据文件进行预读取。

在RocketMQ中，ConsumeQueue逻辑消费队列存储的数据较少，并且是顺序读取，在page cache机制的预读取作用下，Consume Queue文件的读性能几乎接近读内存，即使在有消息堆积情况下也不会影响性能。

而对于CommitLog消息存储的日志数据文件来说，读取消息内容时候会产生较多的随机访问读取，严重影响性能。如果选择合适的系统IO调度算法，比如设置调度算法为“Deadline”（此时块存储采用SSD的话），随机读的性能也会有所提升。

另外，RocketMQ主要通过MappedByteBuffer对文件进行读写操作。其中，利用了NIO中的FileChannel模型将磁盘上的物理文件直接映射到用户态的内存地址中（这种mmap的方式减少了传统IO将磁盘文件数据在操作系统内核地址空间的缓冲区和用户应用程序地址空间的缓冲区之间来回进行拷贝的性能开销），将对文件的操作转化为直接对内存地址进行操作，从而极大地提高了文件的读写效率。正因为需要使用内存映射机制，故RocketMQ的文件存储都使用定长结构来存储，方便一次将整个文件映射至内存。

## 消息刷盘

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211022207529.png" alt="img" style="zoom:67%;" />

(1) 同步刷盘：如上图所示，只有在消息真正持久化至磁盘后RocketMQ的Broker端才会真正返回给Producer端一个成功的ACK响应。同步刷盘对MQ消息可靠性来说是一种不错的保障，但是性能上会有较大影响，一般适用于金融业务应用该模式较多。

(2) 异步刷盘：能够充分利用OS的PageCache的优势，只要消息写入PageCache即可将成功的ACK返回给Producer端。消息刷盘采用后台异步线程提交的方式进行，降低了读写延迟，提高了MQ的性能和吞吐量。

## 通信方式

在RocketMQ消息队列中支持通信的方式主要有同步(sync)、异步(async)、单向(oneway) 三种。其中“单向”通信模式相对简单，一般用在发送心跳包场景下，无需关注其Response。

RocketMQ消息队列集群主要包括NameServer、Broker(Master/Slave)、Producer、Consumer4个角色，基本通讯流程如下：

(1) Broker启动后需要完成一次将自己注册至NameServer的操作；随后每隔30s时间定时向NameServer上报Topic路由信息。

(2) 消息生产者Producer作为客户端发送消息时候，需要根据消息的Topic从本地缓存的TopicPublishInfoTable获取路由信息。如果没有则更新路由信息会从NameServer上重新拉取，同时Producer会默认每隔30s向NameServer拉取一次路由信息。

(3) 消息生产者Producer根据2）中获取的路由信息选择一个队列（MessageQueue）进行消息发送；Broker作为消息的接收者接收消息并落盘存储。

(4) 消息消费者Consumer根据2）中获取的路由信息，并再完成客户端的负载均衡后，选择其中的某一个或者某几个消息队列来拉取消息并进行消费。

从上面1）~3）中可以看出在消息生产者，Broker和NameServer之间都会发生通信（这里只说了MQ的部分通信），因此如何设计一个良好的网络通信模块在MQ中至关重要，它将决定RocketMQ集群整体的消息传输能力与最终的性能。

## 主从同步

两种类型：

- 同步双写 SYNC_MASTER

- 异步复制 ASYNC_MASTER

如果是SYNC_MASTER模式，消息发送者将消息刷写到磁盘后，需要继续等待新数据被传输到从服务器，从服务器数据的复制是在另外一个线程HAConnection中去拉取，所以消息发送者在这里需要等待数据传输的结果，GroupTransferService就是实现该功能。

而ASYNC_MASTER模式，消息在master写入成功，即会返回成功，无需等待slave。

## 参考

https://github.com/apache/rocketmq/blob/master/docs/cn/design.md