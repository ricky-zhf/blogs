---
title: "package和go_package"
date: 2023-02-03
lastmod: "2023-02-03"
author: "ricky"
summary: "gRPC中package和go_package的区别" #摘要
tags: ["grpc"]
categories: ["system"]
lightgallery: false
autonumber: true
---

## package和go_package

对于一个的go项目，包管理一般需要go module管理，同理对于pb包也是。所以需要在pb项目先`go mod init pb项目名`，然后再定义proto文件。

在定义时有package和option go_package两个属性，俩者的区别大致为：

假设B定义的package是bPB, 定义的option_go的package是pbGO。则<mark>proto文件<mark>A引用proto文件B定义的messag时，需要加B定义的bPB前缀。其他go文件需要引用B生成的Go文件内容时，需要加前缀pbGO。详细如下：

- package属于 proto 文件自身的范围定义，与生成的 go 代码无关。这个 proto 的 `package` 的存在是为了避免当引用其他 proto 文件的message时导致的文件内的命名冲突，可以理解为message的前缀。所以，**在<mark>引用<mark>非本包(<mark>这个包是指proto文件声明package，而不是goland目录的包<mark>)的 `message` 时，需要加 package 前缀**。<mark>所以假设两个文件在同一包，但是package定义的名字不同，则引用时也等同于非本包导入。<mark>

- 而 `option go_package` 的声明就和生成的 go 代码相关了，**它定义了生成的 go 文件所属包的完整包名，所谓完整，是指相对于该项目的完整的包路径，应以项目的 Module Name 为前缀**。假设文件B的proto文件中没有指定好这个，文件A引用了文件B的message X，在proto文件中可以通过第一个的package引用，不会报错，但是文件A生成的go文件会引用到文件A自己的X，找不到导致报错。
- import时填的包名就是gloand文件目录路径。

举个栗子：包结构如下，首先在blog.proto文件定义不同的package和go_package，查看生成的go文件包名。然后在user.proto文件中引用blog.proto文件，看需要怎么引用。

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301242155381.png" alt="image-20230124215505348" style="zoom:50%;" />

```protobuf
syntax = "proto3";

option go_package="github.com/ricky-zhf/go-web/common/pb/blog;blogGo";
//这里如果直接用./blog，后续依赖该文件的user.proto所生成go文件会报错，找不到依赖的message。
package blogProto;

service BlogService {
  rpc GetBlog (GetBlogRequest) returns (GetBlogResponse) {}
}
message GetBlogRequest {
  string title = 1;
}
message GetBlogResponse {
  repeated Blog blog = 1;
}
message Blog {
  string author = 1;
  string title = 2;
  string content = 3;
}
```

生成的go文件如下，可以看到go文件的包名是blogGo

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301242201879.png" alt="image-20230124220100806" style="zoom: 50%;" />

假设需要在user.proto文件中引用blog.proto文件：

```protobuf
syntax = "proto3";

option go_package="github.com/ricky-zhf/go-web/common/pb/user";
package user;

import "pb/blog/blog.proto"; //import时填的包名就是gloand文件目录路径。

service UserService { 
  rpc GetAllUserBlogs (GetAllUserBlogsRequest) returns (GetAllUserBlogsResponse) {}
}
message GetAllUserBlogsRequest {
  string user_id = 1;
}
message GetAllUserBlogsResponse {
  repeated blogProto.Blog blog = 1; 
  //引用blog目录下，proto定义的package name为blogProt的message Blog
}
```

如果是在其他go文件中引用blog定义的Blog message则如下图，可以看到引入包的路径就是正常路径，但是使用时要用

<img src="https://cdn.jsdelivr.net/gh/ricky-zhf/images/img/202301251024636.png" style="zoom: 33%;" />

