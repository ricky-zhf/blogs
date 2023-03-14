---
title: "clean code笔记"
date: 2023-01-11
lastmod: "2023-01-22"
author: "ricky"
summary: "clean code读书笔记" #摘要
tags: ["book"]
categories: ["book"]
lightgallery: false
autonumber: true
---

## 有意义的命名

### 名副其实

保证某一块代码中所有的名字能通过名字知道其意义。

- <mark>函数名<mark>
- <mark>变量名<mark>

```java
public List<int[]> getThem(){
  List<int[]> list1 = new ArrayList<int[]>();
  for(int[] x : theList) {
    if(x[0] <mark> 4) {
      list1.add(x)
    }
  }
  return list1;
}
```

这段代码有很多模糊的地方。

- theList是什么含义？
- theList中0下标条目是什么含义？
- 值4是什么含义？
- 返回的list1是什么含义？

假设这是一个扫雷游戏，theList是单元格列表，其中数据0下标条目的含义是该单元格的状态，为4表示该单元格已标记，最后返回的是已经被标记的单元格List。则对于以上问题可以依次解决：

- theList —— gameBoard；
- 对于单元格，应该抽象为一个对象，创建一个Cell类，状态作为对象的一个属性；
- 然后未该类写一个方法isFlagged来表示该单元格被标记为4；
- list1 —— flaggedCells

最后改进后的代码

```java
public List<int[]> getFlaggedCells(){
  List<int[]> flaggedCells = new ArrayList<int[]>();
  for(Cell cell: gameBoard) {
    if(cell.isFalgged()) {
      flaggedCells.add(cell)
    }
  }
  return flaggedCells;
}
```

### 误导与区分

起变量名避免CS的专有名词，如账号列表如果起名accountList，会让人误以为它是一个list类型(如果是可以这样起名)。

同时，<mark>多使用常量<mark>。

## 函数

### 抽象层级

每个函数应该是一个抽象层级。在实现代码或者阅读代码时需要按照<mark>向下原则<mark>。使用TO(要***)语句，程序就像是一系列TO+函数名的段落，每一段都描述当前的抽象层级，并引用下一抽象层级。

- 既<mark>要(to)更新订单状态<mark>我们先判断，发货成功，则<mark>要(to)<mark>调用处理发货成功的逻辑，发货失败，则调用处理发货失败的逻辑。
  - <mark>要(to)处理发货成功后的步骤<mark>，我们需要先更新订单，再添加延迟队列，再通知各个依赖放该单已发货成功。
    - <mark>要(to)通知各个依赖方<mark>，...
  - <mark>要(to)处理发货失败后的逻辑<mark>，...

同时各个函数要保证<mark>短小<mark>，每个函数只说一件事。对于if、while等条件语句，其内部的代码块一般建议一行。如果函数只是做了该函数名下同一抽象层的步骤，则函数只做了一件事。<mark>既函数要么做什么事，要么回答什么事<mark>

比如函数：

```java
public boolean set(String attribute, String value){
  if(table.isExist(attribute)) {
    table.attribute = value;
    return true;
  } else {
    return false;
  }
}
  
if(set("userName", "uncleBob"))...
```

set函数的操作是先判断table中是否有attribute变量，如果有就覆盖为value，如果没有就返回false。但是如果读者只看if语句，则会误以为set成功返回true，失败返回false。一个set既获取信息，又修改信息。所以可以改成

```java
public void set(String attribute, String value){
  // 赋值
}
public boolean isExist(String attribute){
  // 判断是否存在
}

if(isExist("userName")){
	set("userName", "uncleBob")
}
```

### 函数命名

不要怕长，越详细越好。<mark>根据函数名就能清楚的知道函数做了什么。<mark>

使用动词+关键字的模式，如assertEquals，就可以改进为assertExpectEqualsActual。

### 函数参数

函数参数越少越好，最好是一到两个，最多不能超过三个。<mark>多参数函数需要考虑将有联系的参数封装成类。<mark>

#### 单参数函数

单个入参主要有两种场景：

- 获取入参相关信息，如：boolean fileExists("MyFile")
- 修改入参相关状态，如：InputStream fileOpen("MyFile")

#### 双参数函数

双参数也可以接受。某些必须情况下的确需要传递两个参数(如坐标)。但是其他场景下可以考虑将两个参数优化成一个参数。例如：

```java
writeField(outputStream, name) 
->将该方法作为outputStream的成员之一：outputStream.writeField(name)
->把outputStream写成当前类的成员变量，从而无需再传递它。
```

#### 输出参数

```java
appendFooter(s)
```

这个函数很迷惑，是把什么东西添加到s后面还是把s添加到什么后面？普遍而言，应避免使用输出参数，如果函数必须要修改某种状态，可以修改所属对象的状态。如：

```java
s.appendFooter()
```



## 对象和数据结构

描述了对象与数据结构之间的关系，两者是对立的。

既使用面向对象的代码难以添加新函数，因为需要修改所有的类。

而面向数据结构的代码难以添加新的数据结构，因为必须修改所有的函数 。