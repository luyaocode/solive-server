import express from 'express';
import bodyParser from 'body-parser';

import { Sequelize, DataTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";

// 日志模块
import { createLogger } from './logger.js';
const logger = await createLogger('luyaocode.github.io.server');

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

        logger.info("Database & table synced!");
        const posts = await Blog.findAll();
        logger.info(`All posts: ${JSON.stringify(posts, null, 2)}`);
    } catch (error) {
        logger.error('Error occurred:', error);
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
        logger.info(`New post created: ${JSON.stringify(newPost.toJSON(), null, 2)}`);
    } catch (error) {
        logger.error('Error occurred:', error);
    } finally {
        await sequelize.close();
    }
}

const updateBlog = async (uuid, title, content) => {
    const { sequelize, Blog } = initdb();
    try {
        await sequelize.sync();
        const [updatedRows] = await Blog.update(
            {
                title: title,
                content: content,
                time: new Date() // 更新记录的时间
            },
            {
                where: { id: uuid }
            }
        );

        if (updatedRows > 0) {
            logger.info(`Blog post with ID ${uuid} was successfully updated.`);
            return true;
        } else {
            logger.warn(`No blog post found with ID ${uuid}.`);
            return false;
        }
    } catch (error) {
        logger.error('Error occurred while updating blog:', error);
        return false;
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
            logger.info(`Title: ${blog.title}, Author: ${blog.author}, Time: ${blog.time}`);
            return {
                id: blog.id,
                title: blog.title,
                author: blog.author,
                time: blog.time,
            }
        });
        return res;
    } catch (error) {
        logger.error('Error occurred:', error);
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

            logger.info(`Found blog - Title: ${result.title}, Author: ${result.author}, Content: ${result.content},,Time: ${result.time}`);
            return result;
        } else {
            logger.info(`No blog found with id: ${id}`);
            return null;
        }
    } catch (error) {
        logger.error('Error finding blog by id:', error);
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
        logger.info(`Deleted ${deletedRows} rows`);
    } catch (error) {
        logger.error('Error deleting blog:', error);
    } finally {
        await sequelize.close();
    }
}

// const getBlogsLatestUpdateTime = async () => {
//     const { sequelize, Blog } = initdb();
//     try {
//         const latestUpdate = await Blog.findOne({
//             order: [['updatedAt', 'DESC']],
//             attributes: ['updatedAt']
//         });
//         if (latestUpdate) {
//             logger.info(`Latest update: ${latestUpdate.updatedAt}`);
//             return latestUpdate.updatedAt;
//         } else {
//             return null;
//         }
//     } catch (error) {
//         logger.error('Error deleting blog:', error);
//     } finally {
//         await sequelize.close();
//     }
// }

/**
 *
 * @returns 最新的修改记录（包括软删除、增加、修改）
 */
const getBlogsLatestUpdateTime = async () => {
    const { sequelize, Blog } = initdb();
    try {
        // 获取最新的更新时间记录
        const latestUpdate = await Blog.findOne({
            order: [['updatedAt', 'DESC']],
            paranoid: false, // 包括软删除的记录
        });

        // 获取最新的创建时间记录
        const latestCreated = await Blog.findOne({
            order: [['createdAt', 'DESC']],
            paranoid: false, // 包括软删除的记录
        });

        // 比较两个记录的时间戳并返回最新的记录
        let latestRecord = null;
        if (latestUpdate && latestCreated) {
            const latestUpdateTime = new Date(latestUpdate.updatedAt).getTime();
            const latestCreateTime = new Date(latestCreated.createdAt).getTime();

            // 根据时间戳选择最新记录
            latestRecord = latestUpdateTime > latestCreateTime ? latestUpdate : latestCreated;
        } else {
            latestRecord = latestUpdate || latestCreated;
        }

        if (latestRecord) {
            logger.info(`Latest record (including soft-deleted): ${JSON.stringify(latestRecord)}`);
            return latestRecord;
        } else {
            logger.info('No records found.');
            return null;
        }
    } catch (error) {
        logger.error('Error fetching the latest record:', error);
    } finally {
        await sequelize.close();
    }
};


/**
 * 恢复所有软删除的记录
 * @returns None
 */
async function restoreAllBlogs() {
    const { sequelize, Blog } = initdb();
    try {
        const restoredRows = await Blog.restore({
            where: {}, // 不指定条件，恢复所有软删除记录
            // paranoid: true // 确保这是一个软删除的恢复
        });

        if (restoredRows > 0) {
            logger.info(`Restored ${restoredRows} blogs`);
        } else {
            logger.info('No soft-deleted blogs found to restore');
        }
    } catch (error) {
        logger.error('Error restoring blogs:', error);
    } finally {
        await sequelize.close();
    }
}

rundb();
//
// restoreAllBlogs();

import http from 'http';
import https from 'https';
import fs from 'fs';

const app = express();
const port = 5001;

let ssl_crt, ssl_key;
let server, options;
if (process.env.NODE_ENV === 'prod') {
    ssl_crt = '/home/luyao/codes/solive-server/ssl/api.chaosgomoku.fun.pem';
    ssl_key = '/home/luyao/codes/solive-server/ssl/api.chaosgomoku.fun.key';
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
    if (!Array.isArray(pwd) || pwd.length !== 7) {
        return false;
    }

    const today = new Date();
    let dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
        dayOfWeek = 7;
    }
    // 检查数组中的条件
    for (let i = 0; i < pwd.length; i++) {
        if (i === dayOfWeek - 1) {
            if (Number(pwd[i]) !== dayOfWeek) {
                return false;
            }
        } else {
            if (pwd[i] !== '') {
                return false;
            }
        }
    }
    return true;
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
        logger.info(error);
    }
});

// 处理 POST 请求的路由
app.post('/update', async (req, res) => {
    const { type, uuid, title, content } = req.body;
    const pwd = req.body['pwd[]'];
    res.set('Access-Control-Allow-Origin', '*');
    let opRet = false;
    try {
        if (!check(pwd)) {
            res.status(200).send({data: "博客上传失败！暗号错误",code:-1});
            return;
        }
        if (type === 'blog') {
            opRet=updateBlog(uuid,title,content);
        }
        // 向父进程发送消息
        // process.send({ received: true });
        // 发送状态码为 200 和消息给客户端，并设置 CORS 头部，通配符允许所有来源的ip地址的访问
        if (opRet) {
            res.status(200).send({ data:"博客修改成功！",code:0});
        }
        else {
            res.status(200).send({data: "博客修改失败",code:-1});
        }
    }
    catch(error) {
        logger.info(error);
    }
});

app.get('/blogs/get-latest-update-time', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
        const latestUpdateTime = await getBlogsLatestUpdateTime();
        res.status(200).send(latestUpdateTime);
    } catch (error) {
        logger.error(error);
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
        logger.info(error);
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
        logger.info(error);
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
        logger.info(error);
    }
});

// 启动 Express 服务器
server.listen(port, () => {
    logger.info(`Child process is listening on port: ${port}`);
});
