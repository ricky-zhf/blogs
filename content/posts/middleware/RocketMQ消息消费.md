---
title: "rocketmq消息消费"
date: 2023-02-09
lastmod: "2023-02-14"
author: "ricky"
summary: "rocketmq消息消费总结" #摘要
tags: ["mq"]
categories: ["middleware"]
autonumber: true

#featuredImage: "/img/uu0.jpeg" #文章头+预览
#featuredImagePreview: "/img/uu0.jpeg" #预览
---

## 消费者组

RocketMQ中，订阅者的概念是通过消费组（Consumer Group）来体现的。

- <mark>每个消费组都消费主题中的所有队列，不同消费组之间消费进度彼此不受影响<mark>，也就是说，一条消息被Consumer Group1消费过，也会再给Consumer Group2消费。

- 消费组中包含多个消费者，<mark>同一个组内的消费者是竞争消费的关系，每个消费者负责消费某条队列中的消息。<mark>默认情况，如果一条消息被消费者Consumer1消费了，那同组的其他消费者就不会再收到这条消息。

<mark>消费逻辑大致为：<mark>

- 每个消费者**组**消费Topic下的所有队列，该组中每个消息可以消费多个消息队列，但是每个消息队列同一时间只能被同一消费组内的一个消费者消费；
- 同一个Topic可以被多个消费者**组**消费，同一条队列可以被不同消费者组的消费者消费

在消息队列RocketMQ版领域模型中，同一条消息支持被多个消费者分组订阅，同时，对于每个消费者分组可以初始化多个消费者。您可以根据消费者分组和消费者的不同组合，实现以下两种不同的消费效果：

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211031435832.png" alt="消费方式" style="zoom: 33%;" />

- 消费组间广播消费：如上图所示，<mark>每个消费者分组只初始化唯一一个消费者<mark>，<mark>每个消费者可消费到消费者分组内所有的消息<mark>，各消费者分组都订阅相同的消息，以此实现单客户端级别的广播一对多推送效果。<mark>该方式一般可用于网关推送、配置推送等场景。<mark>
- 消费组内共享消费：如上图所示，<mark>每个消费者分组下初始化了多个消费者，这些消费者共同分担消费者分组内的所有消息<mark>，实现消费者分组内流量的水平拆分和均衡负载。<mark>该方式一般可用于微服务解耦场景。<mark>

## 消息获取

https://www.jianshu.com/p/70800fe967fd

一般消息消费的模式有两种方式：

- <mark>Push Consumer：消息由RocketMQ送至Consumer。<mark>
- Pull Consumer：该类Consumer主动从RocketMQ拉取消息。目前仅TCP Java SDK支持该类Consumer。

这两种方式都有各自的缺点：

1. 拉取：拉取的间隔不好确定，间隔太短没消息时会造成带宽浪费，间隔太长又会造成消息不能及时被消费
2. 推送：**「推送和速率难以适配消费速率」**，推的太快，消费者消费不过来怎么办？推的太慢消息不能及时被消费

RocketMQ结合了两种模式(实质上还是pull)，<mark>Consumer发送拉取请求到Broker端，如果Broker有数据则返回，然后Consumer端再次拉取。如果Broker端没有数据，不立即返回，而是等待一段时间（例如5s）。<mark>

- 如果在等待的这段时间，有新消息到来，则激活consumer发送来hold的请求，立即将消息通过channel写入consumer客户，随后Consumer端再次拉取。
- 如果等待超时（例如5s），也会直接返回，不会将这个请求一直hold住，Consumer端再次拉取。

<mark>长轮询解决轮询带来的频繁请求服务端但是没有的问题一旦新的数据到了，那么消费者能立马就可以获取到新的数据，所以从效果上，有点像是push的感觉。<mark>

## 消费模式

默认情况下就是**集群消费**，当使用集群消费模式时，<mark>消息队列RocketMQ版认为任意一条消息只需要被集群内的任意一个消费者处理即可。<mark>

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211061448467.png" alt="集群消费" style="zoom:50%;" />

当使用**广播消费模式**时，消息队列RocketMQ版会将每条消息推送给集群内所有的消费者，<mark>保证消息至少被每个消费者消费一次。<mark>

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211061449475.png" alt="广播消费" style="zoom: 50%;" />

## 消息处理

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211061442834.png" alt="img" style="zoom: 67%;" />

当拉取到消息后，消息会被放入msgTreeMap，其中key为消息的offset，value为消息实体。

另外还有一个重要的属性dropped，和重平衡相关，重平衡的时候会造成消息的重复消费。

msgCount（未消费消息总数）和msgSize（未消费消息大小）是和流控相关的。

## 消息过滤

RocketMQ分布式消息队列的消息过滤方式有别于其它MQ中间件，<mark>是在Consumer端订阅消息时再做消息过滤的<mark>。<mark>RocketMQ这么做是在于其Producer端写入消息和Consumer端订阅消息采用分离存储的机制来实现的，Consumer端订阅消息是需要通过ConsumeQueue这个消息消费的逻辑队列拿到一个索引，然后再从CommitLog里面读取真正的消息实体内容，所以说到底也是还绕不开其存储结构。<mark>其ConsumeQueue的存储结构如下，可以看到其中有8个字节存储的Message Tag的哈希值，基于Tag的消息过滤正是基于这个字段值的。

![img](https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211022217853.png)

主要支持如下2种的过滤方式 

- Tag过滤方式：Consumer端在订阅消息时除了指定Topic还可以指定TAG，如果一个消息有多个TAG，可以用||分隔。其中，Consumer端会将这个订阅请求构建成一个 SubscriptionData，发送一个Pull消息的请求给Broker端。Broker端从RocketMQ的文件存储层—Store读取数据之前，会用这些数据先构建一个MessageFilter，然后传给Store。Store从 ConsumeQueue读取到一条记录后，会用它记录的消息tag hash值去做过滤，由于在服务端只是根据hashcode进行判断，无法精确对tag原始字符串进行过滤，故在消息消费端拉取到消息后，还需要对消息的原始tag字符串进行比对，如果不同，则丢弃该消息，不进行消息消费。
- SQL92的过滤方式：这种方式的大致做法和上面的Tag过滤方式一样，只是在Store层的具体过滤过程不太一样，真正的 SQL expression 的构建和执行由rocketmq-filter模块负责的。每次过滤都去执行SQL表达式会影响效率，所以RocketMQ使用了BloomFilter避免了每次都去执行。SQL92的表达式上下文为消息的属性。

## 消费重试

https://help.aliyun.com/document_detail/440356.html

消费重试指的是，消费者在消费某条消息失败后，消息队列RocketMQ版服务端会根据重试策略重新消费该消息，超过一次定数后若还未消费成功，则该消息将不再继续重试，直接被发送到死信队列中。

## 消息不丢失

消息可能在哪些阶段丢失呢？可能会在这三个阶段发生丢失：生产阶段、存储阶段、消费阶段。所以要从这三个阶段考虑：

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211061618351.png" alt="图片" style="zoom: 67%;" />



**Producer**

- 可以采取send()同步发消息，发送结果是同步感知的。发送失败后可以重试，设置重试次数，默认2次。

- 集群部署，比如发送失败了的原因可能是当前Broker宕机了，重试的时候会发送到其他Broker上。

**Broker**

- 同步刷盘和异步刷盘，不管哪种刷盘都可以保证消息一定存储在pagecache中（内存中），但是同步刷盘更可靠，它是Producer发送消息后等数据持久化到磁盘之后再返回响应给Producer。所以修改刷盘策略为同步刷盘，默认情况下是异步刷盘的。flushDiskType = SYNC_FLUSH

- Broker通过主从模式来保证高可用，Broker支持Master和Slave同步复制、Master和Slave异步复制模式，生产者的消息都是发送给Master，但是消费既可以从Master消费，也可以从Slave消费。同步复制模式可以保证即使Master宕机，消息肯定在Slave中有备份，保证了消息不会丢失。

**Consumer**

- Consumer保证消息成功消费的关键在于确认的时机，不要在收到消息后就立即发送消费确认，而是应该在执行完所有消费业务逻辑之后，再发送消费确认。因为消息队列维护了消费的位置，逻辑执行失败了，没有确认，再去队列拉取消息，就还是之前的一条。

## 重复消费

### 产生原因

MQ重复消费是指同一个应用的多个实例收到相同的消息，或者同一个实例收到多次相同的消息，若消费者逻辑未做幂等处理，就会造成重复消费。消息重复这个问题本质上是MQ设计上的at least once 还是exactly once的问题，消费者肯定想要exactly once，但MQ要保证消息投递的可靠性，对未ack的消息，会重复投递。

- 正常情况下在consumer真正消费完消息后应该发送ack，通知broker该消息已正常消费。**当ack因为网络原因无法发送到broker，broker会认为此条消息没有被消费**，此后会开启消息重投机制把消息再次投递到consumer。

- 在CLUSTERING集群消费模式下，消息在broker中会保证相同group的consumer消费一次，但是针对不同group的consumer会推送多次。

### 解决办法

因此消费者端要自己保证消费的幂等性，方法如：消费者收到消息后，从消息中获取消息标识写入到Redis或数据库，当再次收到该消息时就不作处理。消息重复投递的场景，除重试外，很大一部分来自于负载均衡阶段，前一个监听Queue的消费实例拉取的消息未全部ack，新的消费实例监听到这个Queue重新拉取消息。

基本上解决办法有如下几种：

- 业务幂等，数据库乐观锁；
- 消息去重：这种方法，需要保证每条消息都有一个惟一的编号，通常是业务相关的，比如订单号，消费的记录需要落库，<mark>而且需要保证和消息确认这一步的原子性。<mark>
- 分布式锁；

## 消息堆积

Producer已经将消息发送到消息队列RocketMQ版的服务端，但由于Consumer消费能力有限，未能在短时间内将所有消息正确消费掉，此时在消息队列服务端保存着未被消费的消息，该状态即消息堆积。

**消息堆积量=处理中消息量+已就绪消息量**，具体的指标含义，可参考以下说明：

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211052346679.png" alt="相关概念" style="zoom:33%;" />

上图表示指定Topic的某一队列中各消息的状态。

- **处理中消息**：在消费者客户端正在处理中但客户端还未返回消费成功响应的消息。

- **已就绪消息**：消息在消息队列已就绪，可以被消费者消费的消息。已就绪消息量指标反映还未被消费者开始处理的消息规模。

  - 已就绪消息的就绪时间：

    - 普通消息：消息的存储时间。
    - 定时/延时消息：定时或延时结束时间。
    - 事务消息：事务提交时间。

  - 已就绪消息的排队时间：最早一条就绪消息的就绪时间和当前时间差。

    该指标反映了还未被处理的消息的延迟时间大小，对于时间敏感的业务来说是非常重要的度量指标。

    示例：如上图所示，最早一条就绪消息M1的就绪时间为12:00:00，最后一条就绪消息M2的就绪时间为12:00:30。假设当前时间为12:00:50，则已就绪消息排队时间=当前时间－M1消息的就绪时间=50秒。

<mark>解决方案：<mark>

首先判断消息挤压的原因

- 如果是Producer太多而Consumer太少，且消息消费速度正常，则可以通过暂时上线多个Consumer来临时解决消息堆积问题；
- 如果当前Topic的Message Queue的数量小于或者等于消费者数量，这种情况，再扩容消费者就没什么用，<mark>就得考虑扩容Message Queue<mark>。
  - 可以新建一个临时的Topic，临时的Topic多设置一些Message Queue，
  - 然后先用一些消费者把消费的数据丢到临时的Topic，因为不用业务处理，只是转发一下消息，还是很快的。
  - 扩容多台消费者去消费新的Topic里的数据。
  - 消费完了之后，恢复原状。

## 参考

https://help.aliyun.com/document_detail/440186.html

https://github.com/apache/rocketmq/blob/master/docs/cn/features.md#%E7%89%B9%E6%80%A7features