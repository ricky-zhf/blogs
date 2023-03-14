---
title: "rocketmq架构"
date: 2023-02-09
lastmod: "2023-02-17"
author: "ricky"
summary: "rocketmq架构" #摘要
tags: ["mq"]
categories: ["middleware"]
autonumber: true
---

## 架构

主要有四大核心组成部分：**NameServer**、**Broker**、**Producer**以及**Consumer**四部分。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202302051830108.png" alt="图片" style="zoom: 67%;" />

RocketMQ架构上主要分为四部分，如上图所示：

- Producer：消息发布的角色，支持分布式集群方式部署。Producer通过MQ的负载均衡模块选择相应的Broker集群队列进行消息投递，投递的过程支持快速失败并且低延迟。
- Consumer：消息消费的角色，支持分布式集群方式部署。支持以push推，pull拉两种模式对消息进行消费。同时也支持集群方式和广播方式的消费，它提供实时消息订阅机制，可以满足大多数用户的需求。
- NameServer：NameServer是一个非常简单的Topic路由注册中心，其角色类似Dubbo中的zookeeper，支持Broker的动态注册与发现。主要包括两个功能
  - Broker管理，NameServer接受Broker集群的注册信息并且保存下来作为路由信息的基本数据。
  - 心跳检测机制，检查Broker是否还存活；
- BrokerServer：Broker主要负责消息的存储、投递和查询以及服务高可用保证。

### NamerServer

可以理解为一个注册中心，==主要用来保存整个Broker集群的路由信息和心跳检测。生产者和消费者通过name server找到各topic对应的broker ip列表==。多个name server组成集群，但是没有信息交互。

- 路由信息：==Broker在启动时会向每一台NameServer注册自己的路由信息，所以每一个NameServer实例上面都保存一份完整的路由信息。==当某个NameServer因某种原因下线了，Broker仍然可以向其它NameServer同步其路由信息，Producer和Consumer仍然可以动态感知Broker的路由的信息。==Producer 在发送消息前会根据 Topic 到 **NameServer** 获取到 Broker 的路由信息，Consumer 也会定时获取 Topic 的路由信息。==
- 心跳检测；

但有一点需要注意，Broker向NameServer发心跳时， 会带上当前自己所负责的所有**Topic**信息，如果**Topic**个数太多（万级别），会导致一次心跳中，就Topic的数据就几十M，网络情况差的话， 网络传输失败，心跳失败，导致NameServer误认为Broker心跳失败。

### Broker

核心的一个角色，==Broker主要负责消息的存储、投递和查询以及服务高可用保证==。在一个Broker集群中，相同的BrokerName可以称为一个Broker组，一个Broker组中, BrokerId为0的为主节点，其它的为从节点。BrokerName和BrokerId是可以在Broker启动时通过配置文件配置的。每个Broker组只存放一部分消息。**每个 Broker 可以存储多个Topic的消息，每个Topic的消息也可以分片存储于不同的 Broker**。

Broker包含了以下几个重要子模块。

1. Remoting Module：整个Broker的实体，负责处理来自Client端的请求。
2. Client Manager：负责管理客户端(Producer/Consumer)和维护Consumer的Topic订阅信息。
3. Store Service：提供方便简单的API接口处理消息存储到物理硬盘和查询功能。
4. HA Service：高可用服务，提供Master Broker 和 Slave Broker之间的数据同步功能。
5. Index Service：根据特定的Message key对投递到Broker的消息进行索引服务，以提供消息的快速查询。

### Producer

**Producer**由用户进行分布式部署，消息由**Producer**通过多种负载均衡模式发送到**Broker**集群，发送低延时，支持快速失败。

**RocketMQ** 提供了多种方式发送消息：

- **同步发送**：同步发送指消息发送方发出数据后会在收到接收方发回响应之后才发下一个数据包。一般用于重要通知消息，例如重要通知邮件、营销短信。

- **异步发送**：异步发送指发送方发出数据后，不等接收方发回响应，接着发送下个数据包，一般用于可能链路耗时较长而对响应时间敏感的业务场景，例如用户视频上传后通知启动转码服务。

- **单向发送**：单向发送是指只负责发送消息而不等待服务器回应且没有回调函数触发，适用于某些耗时非常短但对可靠性要求并不高的场景，例如日志收集。
- **顺序发送**。

​																<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211021958295.png" alt="img" style="zoom: 33%;" />

==生产者和主题的关系为多对多关系，即同一个生产者可以向多个主题发送消息，对于平台类场景如果需要发送消息到多个主题，并不需要创建多个生产者；同一个主题也可以接收多个生产者的消息，以此可以实现生产者性能的水平扩展和容灾。==

### Consumer

用来消费生产者消息的一方，==消费者必须关联一个指定的消费者分组==，以获取分组内统一定义的行为配置和消费状态。

### Group

分为ProducerGroup，ConsumerGroup，代表某一类的生产者和消费者，一个组可以订阅多个Topic。

ProducerGroup代表同一类Producer的集合，这类Producer发送同一类消息且发送逻辑一致。如果发送的是事务消息且原始生产者在发送之后崩溃，则Broker服务器会联系同一生产者组的其他生产者实例以提交或回溯消费。

ConsumerGroup代表同一类Consumer的集合，这类Consumer通常消费同一类消息且消费逻辑一致。消费者组使得在消息消费方面，实现负载均衡和容错的目标变得非常容易。要注意的是，消费者组的消费者实例必须订阅完全相同的Topic。

### 总览

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211021748749.png" alt="img" style="zoom: 67%;" />



- NameServer是一个几乎无状态节点，可集群部署，==节点之间无任何信息同步。==
- Broker部署相对复杂，Broker分为Master与Slave，一个Master可以对应多个Slave，但是一个Slave只能对应一个Master，Master与Slave 的对应关系通过指定相同的BrokerName，不同的BrokerId 来定义，BrokerId为0表示Master，非0表示Slave。Master也可以部署多个。==每个Broker与NameServer集群中的所有节点建立长连接，定时注册Topic信息到所有NameServer。== 注意：当前RocketMQ版本在部署架构上支持一Master多Slave，==但只有BrokerId=1的从服务器才会参与消息的读负载。==
- Producer与NameServer集群中的==其中一个节点（随机选择）建立长连接==，定期从NameServer获取Topic路由信息，==并向提供Topic 服务的Master建立长连接，且定时向Master发送心跳。==Producer完全无状态，可集群部署。
- Consumer与NameServer集群中的==其中一个节点（随机选择）建立长连接==，定期从NameServer获取Topic路由信息，==并向提供Topic服务的Master、Slave建立长连接，且定时向Master、Slave发送心跳。==Consumer既可以从Master订阅消息，也可以从Slave订阅消息，消费者在向Master拉取消息时，Master服务器会根据拉取偏移量与最大偏移量的距离（判断是否读老消息，产生读I/O），以及从服务器是否可读等因素建议下一次是从Master还是Slave拉取。

==结合部署架构图，描述集群工作流程：==

- 启动NameServer，NameServer起来后监听端口，等待Broker、Producer、Consumer连上来，相当于一个路由控制中心。
- Broker启动，跟所有的NameServer保持长连接，定时(30s)发送心跳包。心跳包中包含当前Broker信息(IP+端口等)以及存储所有Topic信息。注册成功后，NameServer集群中就有Topic跟Broker的映射关系。
- 收发消息前，先创建Topic，创建Topic时需要指定该Topic要存储在哪些Broker上，也可以在发送消息时自动创建Topic。
- Producer发送消息，启动时先跟NameServer集群中的其中一台建立长连接，==并从NameServer中获取Topic路由信息并缓存到本地==(TopicPublishInfoTable)，发消息时==轮询==从Topic的队列列表中选择一个队列，==然后与队列所在的Broker建立长连接从而向Broker发消息。==
- Consumer跟Producer类似，跟其中一台NameServer建立长连接，获取当前订阅Topic存在哪些Broker上，然后直接跟Broker建立连接通道，开始消费消息。其中还会做负载均衡后，选择其中的某一个或者某几个消息队列来拉取消息并进行消费。