import express from 'express';
import bodyParser from 'body-parser';

import { Sequelize, DataTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import axios from 'axios';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

// 日志模块
import { createLogger } from './logger.js';
const logger = await createLogger('luyaocode.github.io.server');

// 创建 Sequelize 实例，使用 SQLite 连接数据库

const initdb = () => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: 'luyaocode.github.io.db' // 数据库文件路径
    });

    // 定义标签模型
    const Tag = sequelize.define('Tag', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        }
    });

    // 定义文章模型
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

    // 定义多对多关联
    const BlogTag = sequelize.define('BlogTag', {});

    // 设置模型关联
    Blog.belongsToMany(Tag, { through: BlogTag });
    Tag.belongsToMany(Blog, { through: BlogTag });


    // 同步数据库
    // await sequelize.sync({ force: true }); // 清空数据库，慎用
    sequelize.sync()
    .then(() => {
        console.log('数据库已同步');
    })
    .catch(err => {
        console.error('同步失败:', err);
    });

    return { sequelize, Blog, Tag, BlogTag };
}

/**
 * 测试用
 */
const test = async () => {
    async function printBlogsWithTags() {
        const { Blog, Tag } = db; // 确保 db 中导入了 Blog 和 Tag 模型

        try {
            // 查询所有博客，并包括关联的标签
            const blogs = await Blog.findAll({
                include: [{
                    model: Tag,
                    through: { attributes: [] } // 只选择关联表的内容，忽略中间表的属性
                }]
            });

            // 打印每个博客及其关联的标签
            blogs.forEach(blog => {
                console.log(`博客 ID: ${blog.id}, 标题: ${blog.title}, 作者: ${blog.author}, 时间: ${blog.time}`);
                console.log('关联的标签:');
                blog.Tags.forEach(tag => {
                    console.log(`- ${tag.name}`);
                });
            });
        } catch (error) {
            console.error('查询失败:', error);
        }
    }

    // 执行函数
    printBlogsWithTags();
}

const db = initdb(); // 单例

// 标签操作
// 创建标签
createTag("teee");
async function createTag(name) {
    const { Tag } = db;
    try {
        let tag = await Tag.findOne({ where: { name } });
        if (tag) {
            console.log(`标签已存在: ${tag.name}`);
            return;
        }
        tag = await Tag.create({ name });
        console.log(`标签已创建: ${tag.name}`);
    } catch (error) {
        console.error('创建标签失败:', error);
    }
}

async function createTags(tags) {
    if (tags) {
        for (const tag of tags) {
            await createTag(tag);
        }
    }
}

// 查询所有标签
async function getAllTags() {
    test();
    const { Tag } = db;
    try {
        const tags = await Tag.findAll();
        console.log('所有标签:', tags);
        return tags;
    } catch (error) {
        console.error('查询标签失败:', error);
    }
}

// 根据多个标签名查询对应id数组
async function getTagIdsByNames(tagNames) {
    const { Tag } = db;
    try {
        const tags = await Tag.findAll({
            where: {
                name: tagNames
            },
            attributes: ['id']
        });

        const tagIds = tags.map(tag => tag.id);
        return tagIds;
    } catch (error) {
        console.error('Error fetching tag IDs:', error);
        throw error;
    }
}

// 更新标签
async function updateTag(tagId, newName) {
    const { sequelize, Tag } = db;
    const transaction = await sequelize.transaction();
    try {
        const tag = await Tag.findByPk(tagId, { transaction }); // 在事务中查找标签
        if (!tag) {
            logger.info(`未找到标签 ID: ${tagId}`);
            return false;
        }

        const existingTag = await Tag.findOne({ where: { name: newName }, transaction });
        if (existingTag) {
            logger.info(`标签名称已存在: ${newName}`);
            return false;
        }

        tag.name = newName;
        await tag.save({ transaction });
        await transaction.commit();
        logger.info(`标签已更新: ${tagId} -> ${newName}`);
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

// 删除标签
async function deleteTagById(tagId) {
    const { Tag } = db;
    try {
        const deletedCount = await Tag.destroy({
            where: { id: tagId }
        });
        if (deletedCount > 0) {
            logger.info(`已删除标签 ID: ${tagId}`);
            return true;
        } else {
            logger.info(`未找到标签 ID: ${tagId}`);
            return false;
        }
    } catch (error) {
        throw error;
    }
}

// 博客操作
const postBlog = async (uuid, title, content,tags) => {
    const { Blog } = db;
    try {
        const newPost = await Blog.create({
            id: uuid,
            title: title,
            author: 'luyaocode',
            content: content,
            time: new Date()
        });
        await createTags(tags);
        // 关联
        const tagIds=await getTagIdsByNames(tags);
        newPost.setTags(tagIds);

        logger.info(`New post created: ${JSON.stringify(newPost.toJSON(), null, 2)}`);
    } catch (error) {
        logger.error('Error occurred:', error);
    }
}

const updateBlog = async (uuid, title, content) => {
    const { Blog } = db;
    try {
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
    }
}

// 查询所有博客，不带任何条件
const getBlogs = async () => {
    const {Blog}=db;
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
    }
}

// 查询博客，根据标签数组
const getBlogsByTags = async (tags) => {
    if (!tags) {
        return await getBlogs();
    }
    const { Blog, Tag } = db;
    try {
        const blogs = await Blog.findAll({
            attributes: ['id', 'title', 'author', 'time'], // 选择需要的字段
            include: [{
                model: Tag,
                where: { id: tags }, // 使用 tagIds 查询符合条件的标签
                through: { attributes: [] }
            }],
            order: [['time', 'DESC']], // 按时间倒序排序
            logging: console.log // 记录 SQL 查询到控制台
        });

        const res = blogs.map(blog => {
            logger.info(`Title: ${blog.title}, Author: ${blog.author}, Time: ${blog.time}`);
            return {
                id: blog.id,
                title: blog.title,
                author: blog.author,
                time: blog.time,
            };
        });

        return res;
    } catch (error) {
        console.error('查询错误:', error);
        return [];
    }
};

// 查询博客，根据id
const getBlogById = async (id) => {
    const { Blog } = db;
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
    }
};

// 查询博客，根据id数组
const getBlogsByIds = async (ids) => {
    const { Blog } = db;
    try {
        const blogs = await Blog.findAll({
            attributes: ['id', 'title', 'author', 'time'], // 选择需要的字段
            order: [['time', 'DESC']], // 按照时间字段倒序排序
            ...(ids.length > 0 // 如果 blogIds 不为空，则根据其进行过滤
                ? {
                    where: {
                        id: ids
                    }
                }
                : {})
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
        logger.error('Error finding blog by id:', error);
    }
}

// 删除指定 ID 的记录
async function deleteBlogById(id) {
    const { Blog } = db;
    try {
        const deletedRows = await Blog.destroy({
            where: {
            id: id
            }
        });
        logger.info(`Deleted ${deletedRows} rows`);
    } catch (error) {
        logger.error('Error deleting blog:', error);
    }
}
/**
 *
 * @returns 最新的修改记录（包括软删除、增加、修改）
 */
const getBlogsLatestUpdateTime = async () => {
    const { Blog } = db;
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
    }
};

/**
 * 恢复所有软删除的记录
 * @returns None
 */
async function restoreAllBlogs() {
    const { Blog } = db;
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
    }
}
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

// 使用解析cookie的中间件
app.use(cookieParser());

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
    res.set('Access-Control-Allow-Origin', '*');
    // 鉴权
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");
    const { type, uuid, title, content } = req.body;

    const pwd = req.body['pwd[]']; // 参数为数组
    // 若 tags[] 参数只有一个值，req.body['tags[]'] 会被解析为一个字符串，而不是数组。
    // 这是由 Express 的 body - parser 或其他中间件的默认行为决定的。
    // 当参数只有一个值时，它默认作为单个字符串处理；当有多个值时，才会作为数组处理。
    // 这里强制使用数组
    const tags = Array.isArray(req.body['tags[]']) ? req.body['tags[]'] : [req.body['tags[]']];

    try {
        if (!check(pwd)) {
            res.status(200).send({data: "博客上传失败！暗号错误",code:-1});
            return;
        }
        if (type === 'blog') {
            postBlog(uuid,title,content,tags);
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
    res.set('Access-Control-Allow-Origin', '*');
    // 鉴权
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");

    const { type, uuid, title, content } = req.body;
    const pwd = req.body['pwd[]'];
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
    const tags = req.query.tags;
    try {
        const blogs=await getBlogsByTags(tags);
        res.status(200).send(blogs);
    }
    catch(error) {
        logger.info(error);
    }
});

app.get("/blogs_tags", async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");
    try {
        const { Blog, Tag } = db;
        const blogsWithTags = await Blog.findAll({
            attributes: ["id", "title", "time"],
            include: [
                {
                    model: Tag,
                    attributes: ["id", "name"],
                    through: { attributes: [] }, // 排除中间表 BlogTag 的所有字段
                },
            ],
            // where: {
            //     // 添加条件，确保查询到的博客有关联标签
            //     '$Tags.id$': {
            //         [Sequelize.Op.ne]: null // 只返回关联 id 不为 null 的博客
            //     }
            // },
            raw: true,
            nest: true,
        });
        // 确保 Tags 始终是数组
        const result = blogsWithTags.map(blog => {
            if (!Array.isArray(blog.Tags)) {
                if (blog.Tags.id === null) {
                    blog.Tags = [];
                }
                else {
                    blog.Tags = [blog.Tags];
                }
            }
            return blog;
        });
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "服务器错误" });
    }
});

app.get("/tags_blogs", async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");
    try {
        const { Blog, Tag } = db;
        const tagsWithBlogs = await Tag.findAll({
            attributes: ["id", "name",
                [db.sequelize.fn("COUNT", db.sequelize.col("Blogs.id")), "blogCount"] // 计数每个标签下的博客数量
            ],
            include: [
                {
                    model: Blog,
                    attributes: ["id"],
                    through: { attributes: [] }, // 排除中间表 BlogTag 的所有字段
                },
            ],
            group: ["Tag.id"], // 按标签进行分组
            order: [[db.sequelize.fn("COUNT", db.sequelize.col("Blogs.id")), "DESC"]], // 根据博客数量降序排序
            raw: true,
            nest: true,
        });
        // 确保 Tags 始终是数组
        const result = tagsWithBlogs.map(tag => {
            if (!Array.isArray(tag.Blogs)) {
                if (tag.Blogs.id === null) {
                    tag.Blogs = [];
                }
                else {
                    tag.Blogs = [tag.Blogs];
                }
            }
            return tag;
        });
        res.status(200).send(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "服务器错误" });
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
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");
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

// 标签
app.get('/tags', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
        const tags=await getAllTags();
        res.status(200).send(tags);
    }
    catch(error) {
        logger.info(error);
    }
});

// 修改tag
app.post('/tags/:id', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    // 鉴权
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");

    const tagId = parseInt(req.params.id);
    const { name } = req.body;
    try {
        const ret=updateTag(tagId,name);
        res.status(200).send(ret);
    } catch (error) {
        logger.info(error);
    }
});

// 删除标签
app.get('/tags/:id', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    // 鉴权
    const token = req.cookies[AUTH_TOKEN];
    const isValid = await verifyToken(token);
    if (!isValid) return res.status(401).send("未授权");

    const tagId = req.params.id;
    try {
        const ret = await deleteTagById(tagId);
        res.status(200).send(ret);
    } catch (error) {
        logger.info('删除标签失败:', error);
    }
});

// 三方授权
const access_token_params = {
    client_id: "Iv23liOH77T5kmvXYkx8",
    client_secret: "2049b265b21c4a25664400d42732cceda6f7c82c",
}
const myGithubId = 59311239;// 授权用户白名单
const SECRET_KEY = 'luyaocode.github.io'; // 用于签名 JWT 的密钥
const AUTH_TOKEN = 'auth_token';

// 验证 Token 的函数
const verifyToken = async (token) => {
    try {
        await new Promise((resolve, reject) => {
            jwt.verify(token, SECRET_KEY, (err) => {
                if (err) {
                    logger.info("token验证失败:token:"+token+" error:"+err);
                    return reject(err);
                }
                resolve(true);
            });
        });
        return true;
    } catch (err) {
        logger.info(err);
        return false;
    }
};

app.post('/auth', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    const { code } = req.body;
    const {client_id,client_secret } = access_token_params;
    try {
        const response = await axios.post('https://github.com/login/oauth/access_token', null, {
            params: {
                client_id,
                client_secret,
                code,
            },
            headers: {
                Accept: 'application/json'
            },
            timeout: 60 * 1000,
        });

        const access_token = response.data?.access_token;
        if (!access_token) {
            res.status(200).send(false);
            return;
        }
        // 第二步：使用 access_token 获取用户信息
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });

        const { id: githubUserId } = userResponse.data;
        if (!githubUserId || githubUserId !== myGithubId) { //验证失败
            res.status(200).send(false);
            return;
        }
        // 登录成功
        // 生成 JWT
        const token = jwt.sign({ id: githubUserId }, SECRET_KEY, { expiresIn: '1h' }); // 1小时过期
        // 可选择将 token 存储在 cookie 中
        res.cookie(AUTH_TOKEN, token, {
            httpOnly: true, // 仅通过 HTTP 协议访问
            secure: true,   // 仅在 HTTPS 上使用
            maxAge: 60 * 60 * 1000, // cookie 有效期为 1 小时
        });
        res.status(200).send(true);
    } catch (error) {
        logger.info(error);
    }
});

// 启动 Express 服务器
server.listen(port, () => {
    logger.info(`Child process is listening on port: ${port}`);
});
