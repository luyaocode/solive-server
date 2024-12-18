#!/bin/bash

# 定义目标服务器的 IP 地址
servers=("192.168.204.129")

# 压缩本地的 node_modules 文件夹
tar -czvf node_modules.tar.gz node_modules/

# 遍历所有目标服务器
for server in "${servers[@]}"; do
    # 复制 node_modules.tar.gz 到远程服务器
    scp -r node_modules.tar.gz root@$server:/home/luyao/codes/solive-server

    # 检查复制是否成功
    if [ $? -eq 0 ]; then
        echo "复制到 $server 成功"
    else
        echo "复制到 $server 失败"
        exit 1
    fi

    # 连接到远程服务器，解压缩并替换原有的 node_modules 文件夹
    ssh root@$server << EOF
    cd /home/luyao/codes/solive-server
    rm -rf node_modules/
    tar -xzvf node_modules.tar.gz
    rm -rf node_modules.tar.gz # 删除传输的压缩文件
EOF

    echo "已完成 $server 的操作"
done

# 删除本地的压缩文件
rm -rf node_modules.tar.gz

echo "任务完成"

