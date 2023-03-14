---
title: "channel笔记"
date: 2023-02-19
lastmod: 2023-02-22
author: "ricky"
summary: "关于Go中channel的总结" #摘要
tags: ["go"]
categories: ["go"]
lightgallery: false
autonumber: true
#featuredImage: "/img/" #文章头+预览
#featuredImagePreview: "/img/" #预览
---

## CSP

Go 语言中最常见的、也是经常被人提及的设计模式就是：<mark>不要通过共享内存的方式进行通信，而是应该通过通信的方式共享内存。<mark>在很多主流的编程语言中，多个线程传递数据的方式一般都是共享内存，为了解决线程竞争，我们需要限制同一时间能够读写这些变量的线程数量。

虽然我们在 Go 语言中也能使用共享内存加互斥锁进行通信，但是 Go 语言提供了一种不同的并发模型，即通信顺序进程（Communicating sequential processes，CSP）。Goroutine 和 Channel 分别对应 CSP 中的实体和传递信息的媒介，<mark>Goroutine 之间会通过 Channel 传递数据。<mark>Go语言中的channel是一种特殊的类型，一个先进先出的队列。每一个通道都只传输一个具体类型，也就是声明channel的时候需要为其指定元素类型。

![channel-and-goroutines](https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301302238735.png)

目前Go中的channel还是一个有锁的先进先出队列。但是社区也在讨论无锁的实现方式。

通过通信的方式来共享内存，说成人话就是Goroutine A和Goroutine B建立了管道C，通过管道获取和接受的方式来共享变量。例子可以参考：https://qcrao91.gitbook.io/go/channel/channel-fa-song-he-jie-shou-yuan-su-de-ben-zhi-shi-shi-mo

## 数据结构

```go
type hchan struct {
	qcount   uint //当前缓冲中元素个数
	dataqsiz uint //循环数组的长度
	buf      unsafe.Pointer //指向缓冲区内存，这块内存空间可容纳`dataqsize`个元素
	elemsize uint16 //当前 Channel 能够收发的元素大小
	closed   uint32
	elemtype *_type //当前 Channel 能够收发的元素类型
	sendx    uint // 缓冲区中下一个元素写入时的位置
	recvx    uint // 缓冲区中下一个被读取的元素的位置
	recvq    waitq // 当前 Channel 由于缓冲区空间不足而阻塞导致等待接受的Goroutine 队列
	sendq    waitq // 当前 Channel 由于缓冲区空间不足而阻塞导致等待发送的Goroutine 队列
	lock mutex //保证每个读 channel 或写 channel 的操作都是原子的。
}
```

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301302252951.png" alt="img" style="zoom: 50%;" />

`channel`是一种类型，一种引用类型。声明通道类型的格式如下：

```go
 var 变量 chan 元素类型
 --
 var ch1 chan int   // 声明一个传递整型的通道
 var ch2 chan bool  // 声明一个传递布尔型的通道
 var ch3 chan []int // 声明一个传递int切片的通道
```

通道是引用类型，通道类型的空值是`nil`。声明的通道后需要使用`make`函数初始化之后才能使用。

```go
 make(chan 元素类型, [缓冲大小])
 //go语言中需要make的 slice map channel
```

缓冲大小可填可不填。

## 缓冲区

缓冲区底层是一个循环数组，工作机制类似于<mark>环形队列<mark>：

![img](https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301302307585.jpg)

环形队列使得我们可以保证缓冲区有序，并且不需要在每次取出元素时对缓冲区重新排序。当缓冲区满了时，向缓冲区添加元素的协程将被加入`sender`链表中，并且切换到等待状态。之后，当程序读取缓冲区时，`recvx`位置的元素将被返回，等待状态的协程将恢复执行，它要发送的值将被存入缓冲区。这使得 channel 能够保证`先进先出`的特性。

对于channel，有误缓冲区的场景下进行读写操作会有不同的结果：

-  向一个无缓冲区的channel发送数据，会阻塞 ；
-  从一个无缓冲区的channel 接收数据，会阻塞；
-  向一个已经关闭的 channel 发送数据(无论是否有缓冲区)，会引起 panic ；
-  从一个已经关闭的 channel 接收数据，如果缓冲区为空(无论是原本就是无缓冲区还是缓冲区的值读完了)，则返回一个零值。否则返回缓冲区中的值； 

对于缓冲区的读写问题有一个口诀([参考](https://www.yuque.com/aceld/golang/ahkkr1))：<mark>空读写阻塞，写关闭异常，读关闭空零。</mark>

### 无缓冲通道

无缓冲的通道又称为阻塞的通道。

```go
 func main() {
   ch := make(chan int)
   ch <- 10
   fmt.Println("发送成功")
 }
```

上面这段代码能够通过编译，但是执行的时会出现<mark>死锁错误</mark>，即程序被挂起导致死锁。因为<mark>无缓冲的通道只有在接收方准备就绪后才能发送值给该管道，在此之前则一直处于阻塞状态。</mark>因此上面的代码会一直阻塞在第三行。同理，如果对一个无缓冲通道执行接收操作时，没有任何向通道中发送值的操作那么也会导致接收操作阻塞。

使用无缓冲通道进行通信将导致发送和接收的`goroutine`同步化。因此，无缓冲通道也被称为`同步通道`。

注意，上述的死锁一般只出现在主协程中，即如果主协程只对某个channel发送或者接受值，而没有其他协程做对应操作，则会发生死锁阻塞问题。但是如果是子协程则不会出现这个问题，如下面的程序会正常输出end，而不会发生死锁。

```go
func main() {
	ch := make(chan string)
	go func() {
		fmt.Println(<-ch)
	}()
	fmt.Println("end")
}
```

像如下代码能正常编译执行，但是什么都没打印就结束。因为进程结束，导致所有流程终止。

```go
func main() {
	ch := make(chan string)
	go func() {
		fmt.Println(<-ch)
	}()
	ch <- "aa"
}
```

简而言之，对于无缓冲通道的分析主要就是：

- <mark>在通道close前，检查各阶段通道的读写操作是否能一一对应，以此来判断是否产生死锁问题；</mark>
- close后，就是写关闭异常，读关闭空零的问题。

### 有缓冲通道

如果不想产生阻塞，则可以使用有缓冲通道。如下代码能正常输入aa。

```go
func main() {
	ch := make(chan string, 1)
	ch <- "aa"
	fmt.Println(<-ch)
}
```

## channel操作

channel有三种操作，send，receive, close。

发送和接收都使用`<-`符号

```go
 ch := make(chan int)
 ch <- 10//赋值语句右边赋值给左边，将10赋值给ch通道，就是发送10给ch通道。
 x := <- ch//赋值语句右边赋值给左边, x从ch通道接受一个值。
 //<-ch       从ch中接收值，忽略结果
 close(ch)
```

关于关闭通道需要注意的事情是，只有在通知接收方goroutine所有的数据都发送完毕的时候才需要关闭通道。通道是可以被垃圾回收机制回收的，它和关闭文件是不一样的，在结束操作之后关闭文件是必须要做的，但关闭通道不是必须的。

一般而言需要<mark>总是先接收后发送，并由发送端来关闭。</mark>

对于接收值还可以通过下面这种方式：

```go
value, ok := <- ch
```

- value：从通道中取出的值。
- ok：通道关闭为 false，否则为true。

如果需要循环接受缓冲区的值，有3种方式。

### for

for循环和下面的range循环在无缓冲管道的场景下都需要注意两个点：

- 发送方需要关闭管道。否则接收方通过for循环读取时会报死锁错误，因为不关闭管道，当接收方读完管道内数据后，会一直阻塞。因为第四行的for循环执行完了，但是接收方继续for循环，在11行时由于没有发送方所以死锁。
- 接收方需要判断管道是否关闭然后选择是否跳出for循环。否则当发送方发完数据并关闭管道后，接收方会一直读出零值。

```go
func main() {
	c := make(chan int)
	go func() {
		for i := 0; i < 3; i++ {
			c <- i
			fmt.Println("通道写入", i)
		}
		close(c)
	}()
	for {
		i, ok := <-c 
		if !ok {
			break
		}
		fmt.Println("通道读出:", i)
	}
	fmt.Println("Finished")
}
/*
通道写入 0
通道读出: 0
通道读出: 1
通道写入 1
通道写入 2
通道读出: 2
Finished*/
```

### for range

for range会在管道关闭后自动退出，而不需要像for循环那样做判断。

```go
func main() {
	c := make(chan int)
	go func() {
		for i := 0; i < 5; i++ {
			c <- i
			fmt.Println("通道写入", i)
		}
		close(c)
	}()
	for i := range c {
		fmt.Println("通道读出:", i)
	}
	fmt.Println("Finished")
}
/*通道写入 0
通道读出: 0
通道读出: 1
通道写入 1
通道写入 2
通道读出: 2
Finished*/
```

### select

因此对于channel的处理，更推荐使用select。Go 语言中的 `select`语句用于对一组`case`语句进行选择，并执行对应的代码。类似`switch`，但是`select`语句中所有`case`中的表达式都必须是`channel`的发送或接收操作。Select 语句具有以下几个特点：

- `select` 不存在任何的 `case`：永久阻塞当前 goroutine
- `select` 只存在一个 `case`：阻塞的发送/接收
- `select` 存在多个 `case`：随机选择一个满足条件的`case`执行
- `select` 存在 `default`，其他`case`都不满足时：执行`default`语句中的代码

先看个栗子：

```go
func main() {
	ch := make(chan int, 1)
	for i := 1; i <= 10; i++ {
		select {
		case x := <-ch:
			fmt.Println(x)
		case ch <- i:
		}
	}
}
```

首先是创建了一个缓冲区大小为1的通道 ch，进入 for 循环后：

- 第一次循环时 i = 1，select 语句中包含两个 case 分支，此时由于通道中没有值可以接收，所以`x := <-ch` 这个 case 分支不满足，而`ch <- i`这个分支可以执行，会把1发送到通道中，结束本次 for 循环；
- 第二次 for 循环时，i = 2，由于通道缓冲区已满，所以`ch <- i`这个分支不满足，而`x := <-ch`这个分支可以执行，从通道接收值1并赋值给变量 x ，所以会在终端打印出 1；
- 后续的 for 循环以此类推会依次打印出3、5、7、9。