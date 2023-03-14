---
title: "go算法"
date: 2023-01-14
lastmod: 2023-03-05
author: "ricky"
summary: "go算法" #摘要
tags: ["go"]
categories: ["go"]
lightgallery: false
autonumber: true
#featuredImage: "/img/" #文章头+预览
#featuredImagePreview: "/img/" #预览
---



## 二叉树

二叉树基本都是要用到递归，其思维模式分为两类：

- 遍历递归：是否可以通过遍历一遍二叉树得到答案。如果可以，用一个traverse函数配合外部变量来实现，这叫遍历的思维模式。<mark>即先操作当且节点，操作完后去操作左子树，再操作右子树，相当于前序遍历</mark>。这种思路对应回溯算法的思想；
- 分解递归：是否可以定义一个递归函数，通过子问题(子数)的答案推到出原问题的答案。如果可以，下处这个递归函数的定义，并充分利用这个函数的返回值。即当前节点的为题可以通过左子树和右子树的解来 获得，所以需要先操作左子树、再操作右子树、再计算当前节点的的答案，相当于后续遍历。这种思路对应动态规划的核心框架；

无论用哪个，都需要考虑两个问题：

- 如果单独抽出一个二叉树节点，他需要做什么事情？
- 需要在什么时候做？

### 前中后序遍历

- 前序位置的代码在刚刚进入一个二叉树节点的时候执行；
- 后序位置的代码在将要离开一个二叉树节点的时候执行；
- 中序位置的代码在一个二叉树节点左子树都遍历完，即将开始遍历右子树的时候执行。

比如「 [二叉树的最大深度](https://leetcode.cn/problems/maximum-depth-of-binary-tree/)」问题。如果使用遍历解法，那就需要先处理当前节点的，判断其深度，然后分别遍历左右节点:

```go
var depth int
var maxDepthNum int
func maxDepth(root *TreeNode) int {
    traverse(root)
    fmt.Println(maxDepthNum)
    return maxDepthNum
}
func traverse(root  *TreeNode) {
    if root == nil {
        return
    }
    depth++
    if root.Left == nil && root.Right == nil {
        maxDepthNum = max(maxDepthNum, depth)
    }
    traverse(root.Left)
    traverse(root.Right)
    depth--
}
func max(x, y int) int {
    if x > y {
        return x
    }
    return y
}
```

如果使用分解递归，那就是当前节点的深度等于左右子树两个深度更大的那个，加上自己的1。所以需要先递归，找到左右子树的最大深度，然后再处理当前节点的结果。

```go
func maxDepth(root *TreeNode) int {
    if root == nil {
        return 0
    }
    x := maxDepth(root.Left)
    y := maxDepth(root.Right)
    return max(x, y) + 1
}

func max(x, y int) int {
    if x > y {
        return x
    }
    return y
}
```

### 后序遍历的特殊

当解题发现需要获取左右子树的信息时，就需要考虑后续遍历的操作。

前序位置的代码执行是自顶向下的，而后序位置的代码执行是自底向上的，这也意味着前序位置的代码只能获取父节点传递过来的信息，对于其子节点的信息时不知道的。相反，后续遍历时，由于自底向上，所以不仅知道父节点的信息，也知道子节点的信息。举个例子

### DFS和BFS

DFS（深度优先搜索）和 BFS（广度优先搜索）。如果我们使用 DFS/BFS 只是为了遍历一棵树、一张图上的所有结点的话，那么 DFS 和 BFS 的能力没什么差别，我们当然更倾向于更方便写、空间复杂度更低的 DFS 遍历。不过，某些使用场景是 DFS 做不到的，只能使用 BFS 遍历。这就是本文要介绍的两个场景：层序遍历、最短路径。

先看下DFS：

```go
func dfs(root *TreeNode) {
    if (root == null) {
        return;
    }
    dfs(root.left);
    dfs(root.right);
}
```

BFS 遍历使用队列数据结构：

```java
void bfs(TreeNode root) {
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    while (!queue.isEmpty()) {
        TreeNode node = queue.poll(); // Java 的 pop 写作 poll()
        if (node.left != null) {
            queue.add(node.left);
        }
        if (node.right != null) {
            queue.add(node.right);
        }
    }
}
```

#### 二叉树的层次遍历

这里用两个队列，一个存最终的结果res，一个存当前需要遍历的节点nodes。

在遍历到每个节点时，先创建一个队列levelQueue用于维护每一层的节点，然后遍历nodes，将里面里面的节点都取出来放进levelQueue，与此同时，将每个节点的左右节点分别nodes。最后将levelQueue拼接到res后，然后nodes删除遍历过的节点即可。

```go
func levelOrder(root *TreeNode) [][]int {
    if root == nil {
        return nil
    }
    res := make([][]int, 0) //结果队列
    nodes := make([]*TreeNode, 0) // 遍历队列
    nodes = append(nodes, root)

    for len(nodes) != 0 {
        levelQueue := make([]int, 0)//每一层的队列
        levelLen := len(nodes) //len需要先定，因为for循环里会增加
        for i:= 0; i < levelLen; i++ {
            levelQueue = append(levelQueue, nodes[i].Val)
            if nodes[i].Left != nil {
                nodes = append(nodes, nodes[i].Left)
            }
            if nodes[i].Right != nil {
                nodes = append(nodes, nodes[i].Right)
            }
        }
        res = append(res, levelQueue)
        nodes = nodes[levelLen:]
    }
    return res
}
```

或者使用深度遍历

```go
func levelOrder(root *TreeNode) [][]int {
    res := make([][]int, 0)
    depth := 0
    var t func(root *TreeNode)
    t = func(root *TreeNode) {
        if root == nil {
            return
        }
        if depth >= len(res) {
            res = append(res, []int{})
        }
        res[depth] = append(res[depth], root.Val)
        depth++
        t(root.Left)
        t(root.Right)
        depth--
    }
    t(root)
    return res
}
```

## LRU

```go
/*
   1. 实现一个简易的LRU（最近最少使用）缓存。根据数据的历史访问记录来进行淘汰数据，“如果数据最近被访问过，那么将来被访问的几率也更高”。
   2. 使用双向链表，链表节点中包含cache的key和value，此外还有前后指针
   3. 为了加快判断命中效率，使用map缓存key:*node
   4. 最主要两个方法为put和get：
      4.1 put命中将节点移到链表头；
      4.2 put未命中，根据链表节点数是否超过限制来判断是否需要删除链表尾节点，然后在链表头插入节点；
      4.3 get命中，同4.1;
      4.4 get未命中，返回错误。
*/

type Node struct {
   Key, Value int
   Pre, Next  *Node
}

type LRUCache struct {
   Cap        int
   Len        int
   CacheMap   map[int]*Node
   head, tail *Node
}

func InitLRU(cap int) *LRUCache {
   l := &LRUCache{
      Cap:      cap,
      Len:      0,
      CacheMap: map[int]*Node{},
      head:     &Node{},
      tail:     &Node{},
   }
   l.head.Next = l.tail
   l.tail.Pre = l.head
   return l
}

// 根据key获取 value 以及并更新链表
func (l *LRUCache) Get(key int) int {
   if v, ok := l.CacheMap[key]; ok {
      l.moveToHead(v)
      return v.Value
   }
   return -1
}

func (l *LRUCache) Put(key, value int) {
   if v, ok := l.CacheMap[key]; ok {
      v.Value = value
      l.moveToHead(v)
      return
   }
   //不存在
   node := &Node{key, value, nil, nil}
   for l.Len >= l.Cap {
      //删除尾节点
      l.deleteTail()
   }
   l.insertToHead(node)
}

func (l *LRUCache) deleteTail() {
   temp := l.tail.Pre
   temp.Pre.Next = l.tail
   l.tail.Pre = temp.Pre
   temp.Pre = nil
   temp.Next = nil
   l.Len--
   delete(l.CacheMap, l.tail.Key)
}

// 将访问到的节点更新到链表头
func (l *LRUCache) moveToHead(node *Node) {
   node.Pre.Next = node.Next
   node.Next.Pre = node.Pre
   temp := l.head.Next
   l.head.Next = node
   node.Pre = l.head
   node.Next = temp
   temp.Pre = node
}

// 将创建的节点插入链表头
func (l *LRUCache) insertToHead(node *Node) {
   temp := l.head.Next
   l.head.Next = node
   node.Pre = l.head
   node.Next = temp
   temp.Pre = node
   l.Len++
   l.CacheMap[node.Key] = node
}
```

## 堆

堆的内容涉及两个部分：

- 建堆，或者维护堆；
- 堆排序。

建堆的关键属性就是，父节点的值大于子节点的值， 所以父节点的值自然也大于左右子树所有节点的值，所以根节点就是所有元素中最大的。==但是，堆不能保证左节点大于右节点，所以堆的层次遍历并不能保证顺序==。

而堆排序则是使用堆的性质对一组元素进行排序。因为顶点节点是最大的节点，所以可以直接将其与堆最后一个元素交换(使最后一个位置的是最大元素)。然后对0到(n-1)位置的元素再进行维护堆的操作，就又能找到第二大的元素，再交换到n-1的位置，以此来排序。

### 第k大元素

- 构建大顶堆

```go
func findKthLargest(nums []int, k int) int {
    //建堆
    buildHeap(nums, 0, len(nums))
    //这里需要一个变量存储len值，因为随着堆顶元素和最后一个元素交换，长度需要减1。
    heapLen := len(nums)
    // 这里的可以发现和buildHeap方法很像，buildHeap是从第一个非叶子结点开始调整堆结构。
    // 这里是在从堆低交换元素后，从堆顶元素开始调整堆结构
    for i := len(nums) - 1; i >= 0; i-- {
        nums[0], nums[i] = nums[i], nums[0]
        heapLen--
        heapify(nums, 0, heapLen)
    }
    // 第k大，就是第n-k+1小，就是n-k的位置上的元素
    return nums[len(nums) - k]
}

func buildHeap(heap []int, x, length int) {
    length = len(heap)
    for i := length / 2 - 1; i >=0; i-- {
        //从第一个非叶子结点(length/2-1)开始，从下至上，从右至左地调整结构
        heapify(heap, i, length)
    }
}
func heapify(heap []int, x, length int) {
    // 找到当前节点和其左右子节点的最大值
    large := x
    if x * 2 + 1 < length && heap[x * 2 + 1] > heap[large] {//如果需要构建小顶堆，这里符号变下，其他都不用变
        large = x * 2 + 1
    }
    if x * 2 + 2 < length && heap[x * 2 + 2] > heap[large] {//如果需要构建小顶堆，这里符号变下，其他都不用变
        large = x * 2 + 2
    }
    if large != x {
        heap[x], heap[large] = heap[large], heap[x]
        // 继续比较其父节点
        heapify(heap, large, length)
    }
}
```

### Container包

```go
type IntHeap []int
func (h IntHeap) Len() int           { return len(h) }
func (h IntHeap) Less(x, y int) bool { return h[x] > h[y] }//这里大于就是大顶堆，小于就是小顶堆
func (h IntHeap) Swap(x, y int)      { h[x], h[y] = h[y], h[x] }
func (h *IntHeap) Push(x interface{}) {
	*h = append(*h, x.(int))
}
func (h *IntHeap) Pop() interface{} {
	x := (*h)[len(*h)-1]
	*h = (*h)[:len(*h)-1]
	return x
}
func main() {
    h := &IntHeap{1, 3, 99, 2, 7}
    heap.Init(h)
    heap.Push(h, 10)
    fmt.Println("max", (*h)[0])//max 99
    for h.Len() > 0 {
      fmt.Println(heap.Pop(h))//99 10 7 3 2 1
    }
}
```
