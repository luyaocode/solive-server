#!/bin/bash

# 压缩本地的 build 文件夹
tar -czvf node_modules.tar.gz node_modules/
# 复制 build 文件夹到远端目标路径，完全替换原来的 build 文件夹
scp -r node_modules.tar.gz root@47.97.186.50:/home/luyao/codes/chaos-gomoku-server

# 检查复制是否成功
if [ $? -eq 0 ]; then
    echo "复制成功"
else
    echo "复制失败"
    exit 1
fi
# 连接到远程服务器，解压缩并替换原有的 build 文件夹
ssh root@47.97.186.50 << EOF
cd /home/luyao/codes/chaos-gomoku-server
rm -rf node_modules/
tar -xzvf node_modules.tar.gz
rm -rf node_modules.tar.gz # 删除传输的压缩文件
EOF
rm -rf node_modules.tar.gz

echo "任务完成"
