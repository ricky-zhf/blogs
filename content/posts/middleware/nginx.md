---
title: "nginx学习"
date: 2023-02-02
lastmod: "2023-02-04"
author: "ricky"
summary: "nginx相关内容" #摘要
tags: ["nginx"]
categories: ["middleware"]
autonumber: true
---

## 概念

Nginx是一款轻量级的<mark>Web服务器、代理服务器<mark>，由于它的内存占用少，启动极快，高并发能力强，在互联网项目中广泛应用。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301251241907.jpg" alt="img" style="zoom: 67%;" />

## 正反向代理

### 正向代理

由于防火墙的原因，我们并不能直接访问谷歌，那么我们可以借助VPN来实现，这就是一个简单的正向代理的例子。这里你能够发现，正向代理“代理”的是客户端，而且客户端是知道目标的，而目标是不知道客户端是通过VPN访问的。

![img](https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301251243367.webp)

### 反向代理

当我们在外网访问百度的时候，其实会进行一个转发，代理到内网去，这就是所谓的反向代理，即<mark>反向代理“代理”的是服务器端<mark>，而且这一个过程对于客户端而言是透明的。

![img](https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301251243046.webp)





## 负载均衡

负载均衡有四层负载均衡和七层负载均衡

四层工作在OSI第四层，也就是传输层；七层工作在最高层，也就是应用层。

### 四层负载均衡

四层负载均衡就是使用<mark>IP加端口<mark>的方式进行路由转发，由于其工作在第四层，所以不会查看报文的实际信息。

四层负载均衡具体实现方式为：<mark>通过报文中的IP地址和端口，再加上负载均衡设备所采用的负载均衡算法，最终确定选择后端哪台下游服务器<mark>。

以TCP为例，客户端向负载均衡服务器发送SYN请求建立第一次连接，通过配置的负载均衡算法选择一台后端服务器，并且将报文中的IP地址信息修改为后台服务器的IP地址信息，<mark>因此TCP三次握手连接是与后端服务器直接建立起来的。<mark>

### 七层负载均衡

七层负载均衡一般是基于请求URL地址的方式进行代理转发。由于它工作在第七层，所以在接到客户端的流量以后，还需要一个完整的TCP/IP协议栈。<mark>七层负载均衡会与客户端建立一条完整的连接并将应用层的请求流量解析出来，再按照调度算法选择一个应用服务器，并与应用服务器建立另外一条连接将请求发送过去，因此七层负载均衡的主要工作就是代理。<mark>

## 进程模型

### 概念

nginx在启动后，在unix系统中会以daemon的方式在后台运行，后台进程包含一个master进程和多个worker进程。当然nginx也是支持多线程的方式的，只是我们主流的方式还是多进程的方式，也是nginx的默认方式。nginx采用多进程的方式有诸多好处，所以我就主要讲解nginx的多进程模式吧。

nginx在启动后，<mark>会有一个master进程和多个worker进程。<mark>

- <mark>master进程主要用来管理worker进程<mark>，包含：读取并验证config文件，接收来自外界的信号，向各worker进程发送信号，监控worker进程的运行状态，当worker进程退出后(异常情况下)，会自动重新启动新的worker进程。
- 而基本的网络事件，则是放在worker进程中来处理了。worker进程的个数是可以设置的，一般我们会设置与机器cpu核数一致，这里面的原因与nginx的进程模型以及事件处理模型是分不开的。

多个worker进程之间是对等的<mark>，他们同等竞争来自客户端的请求<mark>，各进程互相之间是独立的。一个请求，只可能在一个worker进程中处理，一个worker进程，不可能处理其它进程的请求。nginx的进程模型，可以由下图来表示：

<img src="https://cdn.nlark.com/yuque/0/2022/png/26269664/1649952871932-a26d9db6-b615-4f68-bf69-2c5a9838b12e.png" alt="Nginx-zh-3-01.png" style="zoom: 67%;" />

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301251251307.png" alt="image-20230125125123260" style="zoom:50%;" />





### 优点

1. 对于每个worker进程来说，独立的进程，不需要加锁，所以省掉了锁带来的开销，同时在编程以及问题查找时，也会方便很多。
2. 采用独立的进程，可以让互相之间不会影响，一个进程退出后，其它进程还在工作，服务不会中断，master进程则很快启动新的worker进程。
3. 如果worker进程的异常退出，肯定是程序有bug了，异常退出，会导致当前worker上的所有请求失败，不过不会影响到所有请求，所以降低了风险。

## 事件处理过程

异步非阻塞的事件处理机制，具体到系统调用就是像select/poll/epoll/kqueue这样的系统调用。它们提供了一种机制，让你可以同时监控多个事件，调用他们是阻塞的，但可以设置超时时间，在超时时间之内，如果有事件准备好了，就返回。

- 解析配置文件，得到需要监听的端口号和IP。<mark>然后在Nginx的Master进程里面初始化这个监控的socket<mark>（创建socket，设置addr，reuse等选项，绑定指定IP及端口号，在监听）。
- fork多个子进程：每个 worker 进程都是从 master进程 fork 过来。<mark>在 master 进程里面，先建立好需要 listen 的 socket（listenfd：监听套接字，listen file descriptor） 之后，然后再 fork 出多个 worker 进程。<mark>
- 所有worker进程的listenfd在新连接到来时变为可读的，为保证只有一个进程处理该连接，<mark>所有woker进程在注册listenfd读事件前需要竞争accept_mutex，抢到互斥锁的那个进程注册listenfd读事件，在读事件里调用accept接受该连接。<mark>
- 子进程进程accept新的连接。此时，客户端可以向nginx发送连接了。当三次握手建立完成，某个子进程accept成功，得到这个刚建好的socket，然后对连接进行封装，及ngx_connection_t结构体
- 设置读写时间处理函数，并添加读写时间来与客户端进行数据的交换

## 负载均衡

- 轮询：每个请求按时间顺序逐一分配到不同的后端服务器，如果后端服务器 down 掉，能自动剔除。
- 哈希：每个请求按访问 ip 的 hash 结果分配，这样每个访客固定访问一个后端服务器，可以解决 session 共享的问题。当然，实际场景下，一般不考虑使用 ip_hash 解决 session 共享。
- 最少连接：下一个请求将被分派到活动连接数量最少的服务器

## 热部署

所谓热部署，就是配置文件nginx.conf修改后，不需要stop Nginx，不需要中断请求，就能让配置文件生效！（nginx -s reload 重新加载/nginx -t检查配置/nginx -s stop）

通过上文我们已经知道worker进程负责处理具体的请求，那么如果想达到热部署的效果，可以想象：

方案一：

修改配置文件nginx.conf后，主进程master负责推送给woker进程更新配置信息，woker进程收到信息后，更新进程内部的线程信息。（有点valatile的味道）

方案二：

修改配置文件nginx.conf后，重新生成新的worker进程，当然会以新的配置进行处理请求，而且新的请求必须都交给新的worker进程，至于老的worker进程，等把那些以前的请求处理完毕后，kill掉即可。

Nginx采用的就是方案二来达到热部署的。

## 其他功能

### 动静分离

Nginx能够提高速度的其中一个特性就是：动静分离，就是把静态资源放到Nginx上(追求高效可以用CDN)，由Nginx管理，动态请求转发给后端。

### 黑名单

Nginx可以进行IP访问控制，有些电商平台，就可以在Nginx这一层，做一下处理，内置一个黑名单模块，那么就不必等请求通过Nginx达到后端在进行拦截，而是直接在Nginx这一层就处理掉。

### 缓存



## 高并发

- 异步非阻塞工作方式。不使用原先BIO，即一个进程处理一个request的方式。而是每进来一个request，会有一个worker进程去处理，但不是全程处理。当处理到可能发生阻塞的地方（比如后端服务器转发request并等待请求返回），这个worker会在发送完请求后注册一个事件：如果当前请求返回了，通知并接着干。然后它就可以处理其他请求<mark>即非阻塞<mark>。客户端也无需等待，可以做其他的事情，<mark>即异步<mark>。这就是为什么说，Nginx 基于事件模型。
- Nginx采用了Linux的epoll模型，epoll模型基于事件驱动机制，它可以监控多个事件是否准备完毕，如果OK，那么放入epoll队列中，这个过程是异步的。<mark>worker只需要从epoll队列循环处理即可。<mark>

## 高可用

**Keepalived+Nginx实现高可用**。

Keepalived是一个高可用解决方案，主要是用来防止服务器单点发生故障，可以通过和Nginx配合来实现Web服务的高可用。（其实，Keepalived不仅仅可以和Nginx配合，还可以和很多其他服务配合）

Keepalived+Nginx实现高可用的思路：

第一：请求不要直接打到Nginx上，应该先通过Keepalived（这就是所谓虚拟IP，VIP）

第二：Keepalived应该能监控Nginx的生命状态（提供一个用户自定义的脚本，定期检查Nginx进程状态，进行权重变化,，从而实现Nginx故障切换）

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301251256616.jpg" alt="img" style="zoom: 67%;" />

## 配置

https://blog.csdn.net/zxd1435513775/article/details/102508463

主配置文件一般处于/etc/nginx/nginx.conf，然后会引用conf.d中的所有conf后缀文件，这里面一般就是自己配置的。静态文件如index.html等一般在/usr/share/nginx/html中

我们使用 nginx 的 http 服务，在配置文件 nginx.conf 中的 http 区域内，配置多个 server ，每一个 server 对应这一个虚拟主机或者域名。

### nginx.conf

```nginx
user  nginx;
worker_processes  auto;
error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;
events {
    worker_connections  1024;
}
http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';
  											#定义日志格式 代号为main

    access_log  /var/log/nginx/access.log  main;#日志保存地址 格式代码 main

    sendfile        on; #高效传输文件的模式 一定要开启
    #tcp_nopush     on;

    keepalive_timeout  65; #客户端服务端请求超时时间

    #gzip  on;

    include /etc/nginx/conf.d/*.conf;
}
```

### conf文件

```nginx
server {
    listen       80; #ipv4
    listen  [::]:80; #ipv6
    server_name  localhost; #匹配域名同一个server_name需要放在同一个server下

    location / {
        root   /usr/share/nginx/html;
        index  rev.html;
        proxy_pass http://router_server:8000; #反向代理 localhost:80的流量代理到router_server:8000
    }
  
  location /api {
    		proxy_pass http://router_server_upstream:8000;
  }

    #access_log  /var/log/nginx/host.access.log  main;
    #error_page  404              /404.html;

    # redirect server error pages to the static page /50x.html
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
```

负载均衡配置

```nginx
# 负载均衡：设置domain 8000和8001是本地用起的两个服务
upstream domain {
    server localhost:8000;
    server localhost:8001;
}
server {  
        listen       8080;        
        server_name  localhost;

        location / {
            # root   html; # Nginx默认值
            # index  index.html index.htm;
            
            proxy_pass http://domain; # 负载均衡配置，请求会被平均分配到8000和8001端口
            proxy_set_header Host $host:$server_port;
        }
}
```