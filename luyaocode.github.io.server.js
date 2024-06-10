import express from 'express';
import bodyParser from 'body-parser';

import { Sequelize, DataTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";

// 创建 Sequelize 实例，使用 SQLite 连接数据库

const initdb = () => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: 'luyaocode.github.io.db' // 数据库文件路径
    });
    const Blog = sequelize.define('Blog',
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: uuidv4,
                primaryKey: true,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false
            },
            author: {
                type: DataTypes.STRING,
                allowNull:false
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            time: {
                type: DataTypes.DATE,
                defaultValue:new Date(),
                allowNull: false
            },
        },
        {
            tableName: 'blog',
            timestamps: true, // 启用时间戳
            paranoid: true, // 启用软删除
        }
    );
    // 钩子：在销毁之前更新 `updatedAt` 字段
    Blog.beforeDestroy(async (instance, options) => {
        await instance.update({ updatedAt: new Date() }, { silent: true });
    });
    return { sequelize, Blog }
}

const rundb = async () => {
    const { sequelize,Blog}=initdb();
    try {
        // await sequelize.sync({ force: true }); // 清空数据库
        await sequelize.sync();

        console.log("Database & table synced!");
        const posts = await Blog.findAll();
        console.log(`All posts: ${JSON.stringify(posts, null, 2)}`);
    } catch (error) {
        console.error('Error occurred:', error);
    } finally {
        await sequelize.close();
    }
};

const postBlog = async (uuid,title, content) => {
    const { sequelize,Blog}=initdb();
    try {
        await sequelize.sync();
        const newPost = await Blog.create({
            id: uuid,
            title: title,
            author: 'luyaocode',
            content: content,
            time: new Date()
        });
        console.log(`New post created: ${JSON.stringify(newPost.toJSON(), null, 2)}`);
    } catch (error) {
        console.error('Error occurred:', error);
    } finally {
        await sequelize.close();
    }
}

const getBlogs = async () => {
    const { sequelize,Blog}=initdb();
    try {
        const blogs = await Blog.findAll({
            attributes: ['id', 'title', 'author', 'time'], // 选择需要的字段
            order: [['time', 'DESC']] // 按照时间字段倒序排序
        });
        const res = blogs.map(blog => {
            console.log(`Title: ${blog.title}, Author: ${blog.author}, Time: ${blog.time}`);
            return {
                id: blog.id,
                title: blog.title,
                author: blog.author,
                time: blog.time,
            }
        });
        return res;
    } catch (error) {
        console.error('Error occurred:', error);
    } finally {
        await sequelize.close();
    }
}

const getBlogById = async (id) => {
    const { sequelize, Blog } = initdb();
    try {
        // 查找指定 id 的记录
        const blog = await Blog.findOne({
            where: { id: id },
            attributes: ['id', 'title', 'author', 'content', 'time'] // 选择需要的字段
        });

        // 如果找到记录，返回所需字段的对象
        if (blog) {
            const result = {
                id: blog.id,
                title: blog.title,
                author: blog.author,
                content: blog.content,
                time: blog.time,
            };

            console.log(`Found blog - Title: ${result.title}, Author: ${result.author}, Content: ${result.content},,Time: ${result.time}`);
            return result;
        } else {
            console.log(`No blog found with id: ${id}`);
            return null;
        }
    } catch (error) {
        console.error('Error finding blog by id:', error);
    } finally {
        await sequelize.close();
    }
};

// 删除指定 ID 的记录
async function deleteBlogById(id) {
    const { sequelize, Blog } = initdb();
    try {
        const deletedRows = await Blog.destroy({
            where: {
            id: id
            }
        });
        console.log(`Deleted ${deletedRows} rows`);
    } catch (error) {
        console.error('Error deleting blog:', error);
    } finally {
        await sequelize.close();
    }
}

const getBlogsLatestUpdateTime = async () => {
    const { sequelize, Blog } = initdb();
    try {
        const latestUpdate = await Blog.findOne({
            order: [['updatedAt', 'DESC']],
            attributes: ['updatedAt']
        });
        if (latestUpdate) {
            console.log(`Latest update: ${latestUpdate.updatedAt}`);
            return latestUpdate.updatedAt;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error deleting blog:', error);
    } finally {
        await sequelize.close();
    }
}

rundb();

import http from 'http';
import https from 'https';
import fs from 'fs';

const app = express();
const port = 5001;

let ssl_crt, ssl_key;
let server, options;
if (process.env.NODE_ENV === 'prod') {
    ssl_crt = '/home/luyao/codes/chaos-gomoku/ssl/api.chaosgomoku.fun.pem';
    ssl_key = '/home/luyao/codes/chaos-gomoku/ssl/api.chaosgomoku.fun.key';
    options = {
        key: fs.readFileSync(ssl_key),
        cert: fs.readFileSync(ssl_crt)
    }
    server = https.createServer(options, app);
}
else if (process.env.NODE_ENV === 'dev') {
    server = http.createServer(app);
}

// 使用 body-parser 中间件来解析请求体
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 校验暗号
const check = (pwd) => {
    if (pwd.length === 0) {
        return false;
    }
    const today = new Date();
    let dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
        dayOfWeek = 7;
    }
    if (pwd[dayOfWeek - 1] == dayOfWeek) {
        return true;
    }
    return false;
}

// 处理 POST 请求的路由
app.post('/publish', async (req, res) => {
    const { type, uuid, title, content } = req.body;
    const pwd = req.body['pwd[]'];
    res.set('Access-Control-Allow-Origin', '*');
    try {
        if (!check(pwd)) {
            res.status(200).send({data: "博客上传失败！暗号错误",code:-1});
            return;
        }
        if (type === 'blog') {
            postBlog(uuid,title,content);
        }
        // 向父进程发送消息
        // process.send({ received: true });
        // 发送状态码为 200 和消息给客户端，并设置 CORS 头部，通配符允许所有来源的ip地址的访问
        res.status(200).send({ data:"博客上传成功！",code:0});
    }
    catch(error) {
        console.log(error);
    }
});

app.get('/blogs/get-latest-update-time', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
        const latestUpdateTime = await getBlogsLatestUpdateTime();
        res.status(200).send(latestUpdateTime);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/blogs', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
        const blogs=await getBlogs();
        res.status(200).send(blogs);
    }
    catch(error) {
        console.log(error);
    }
});

app.get('/blog', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
        const { id } = req.query;
        const blog=await getBlogById(id);
        res.status(200).send(blog);
    }
    catch(error) {
        console.log(error);
    }
});

app.post('/delblog', async (req, res) => {
    const pwd = req.body['pwd[]'];
    res.set('Access-Control-Allow-Origin', '*');
    try {
        if (!check(pwd)) {
            res.status(200).send({data: "博客删除失败！暗号错误",code:-1});
            return;
        }
        const { id } = req.body;
        await deleteBlogById(id);
        res.status(200).send({data: "博客删除成功",code:0});
    }
    catch(error) {
        console.log(error);
    }
});

// 启动 Express 服务器
server.listen(port, () => {
    console.log(`Child process is listening on port: ${port}`);
});
