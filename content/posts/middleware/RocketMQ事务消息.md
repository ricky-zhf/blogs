---
title: "rocketmq事务消息"
date: 2023-02-27
lastmod: "2023-03-01"
author: "ricky"
summary: "rocketmq事务消息介绍" #摘要
tags: ["mq"]
categories: ["middleware"]
autonumber: true
---

## 事务消息

这里RocketMQ采用了<mark>2PC的思想来实现了提交事务消息<mark>，同时增加一个<mark>补偿逻辑<mark>来处理二阶段超时或者失败的消息，如下图所示。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211031428355.png" alt="事务消息" style="zoom: 33%;" />

### 消息流程

- 发送半消息
- 服务端回应消息写入结果
- 根据写入结果执行本地事务（如果写入失败，此时half消息对业务不可见，本地逻辑不执行）。
- 根据本地事务状态执行Commit或者Rollback（Commit操作生成消息索引，消息对消费者可见）。

### 补偿流程

补偿阶段用于解决消息Commit或者Rollback发生超时或者失败的情况。

- 对没有Commit/Rollback的事务消息（pending状态的消息），从服务端发起一次“回查”
- Producer收到回查消息，检查回查消息对应的本地事务的状态
- 根据本地事务状态，重新Commit或者Rollback

### 消息设计

**1.事务消息在一阶段对用户不可见**

在RocketMQ事务消息的主要流程中，一阶段的消息如何对用户不可见。其中，事务消息相对普通消息最大的特点就是一阶段发送的消息对用户是不可见的。那么，如何做到写入消息但是对用户不可见呢？RocketMQ事务消息的做法是：<mark>如果消息是half消息，将备份原消息的主题与消息消费队列，然后改变主题为RMQ_SYS_TRANS_HALF_TOPIC。由于消费组未订阅该主题，故消费端无法消费half类型的消息，然后RocketMQ会开启一个定时任务，从Topic为RMQ_SYS_TRANS_HALF_TOPIC中拉取消息进行回查，根据生产者组获取一个服务提供者发送回查事务状态请求，根据事务状态来决定是提交或回滚消息。<mark>

在RocketMQ中，消息在服务端的存储结构如下，每条消息都会有对应的索引信息，Consumer通过ConsumeQueue这个二级索引来读取消息实体内容，其流程如下：

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211022304295.png" alt="img" style="zoom:50%;" />

RocketMQ的具体实现策略是：写入的如果事务消息，对消息的Topic和Queue等属性进行替换，同时将原来的Topic和Queue信息存储到消息的属性中，正因为消息主题被替换，故消息并不会转发到该原主题的消息消费队列，消费者无法感知消息的存在，不会消费。其实改变消息主题是RocketMQ的常用“套路”，回想一下延时消息的实现机制。

**2.Commit和Rollback操作以及Op消息的引入**

在完成一阶段写入一条对用户不可见的消息后，二阶段如果是Commit操作，则需要让消息对用户可见；如果是Rollback则需要撤销一阶段的消息。

由于 RocketMQ 的 appendOnly 特性，Broker通过 OP 消息实现标记删除。Broker 流程参考下图：

![img](https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211061837121.jpg)

- **Commit**。Broker 写入 OP 消息，OP 消息的 body 指定 Commit 消息的 queueOffset，标记之前 Half 消息已被删除；同时，Broker 读取原 Half 消息，把 Topic 还原，重新写入 CommitLog，消费者则可以拉取消费； 
- **Rollback**。Broker 同样写入 OP 消息，流程和 Commit 一样。但后续不会读取和还原 Half 消息。这样消费者就不会消费到该消息。

**3.Op消息的存储和对应关系**

RocketMQ将Op消息写入到全局一个特定的Topic中。这个Topic是一个内部的Topic（像Half消息的Topic一样），不会被用户消费。Op消息的内容为对应的Half消息的存储的Offset，这样通过Op消息能索引到Half消息进行后续的回查操作。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202211022304634.png" alt="img" style="zoom: 67%;" />

**4.Half消息的索引构建**

在执行二阶段Commit操作时，需要构建出Half消息的索引。一阶段的Half消息由于是写到一个特殊的Topic，所以二阶段构建索引时需要读取出Half消息，并将Topic和Queue替换成真正的目标的Topic和Queue，之后通过一次普通消息的写入操作来生成一条对用户可见的消息。所以R<mark>ocketMQ事务消息二阶段其实是利用了一阶段存储的消息的内容，在二阶段时恢复出一条完整的普通消息，然后走一遍消息写入流程。<mark>

**5.如何处理二阶段失败的消息？**

如果在RocketMQ事务消息的二阶段过程中失败了，例如在做Commit操作时，出现网络问题导致Commit失败，那么需要通过一定的策略使这条消息最终被Commit。

RocketMQ采用了一种补偿机制，称为“回查”。Broker通过异步线程定期执行(默认30s)，针对这些确实OP消息的办消息进行回查。起主要是将消息发送到对应的Producer端（同一个Group的Producer），由Producer根据消息来检查本地事务的状态，进而执行Commit或者Rollback。Broker端通过对比Half消息和OP消息进行事务消息的回查并且推进CheckPoint（记录那些事务消息的状态是确定的）。

值得注意的是，rocketmq并不会无休止的的信息事务状态回查，默认回查15次，如果15次回查还是无法得知事务状态，rocketmq默认回滚该消息。