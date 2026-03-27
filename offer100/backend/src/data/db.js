const mysql = require('mysql2/promise');

// 1. 创建 MySQL 连接池
// 请务必根据你的 Navicat 连接信息修改这里的参数
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',           // 数据库用户名
  password: '123456',    // 数据库密码
  database: 'super644',   // 数据库名
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * 初始化数据库连接
 * 对应 server.js 中的 initDb() 调用
 */
async function initDb() {
  try {
    // 尝试执行一个简单的查询来验证连接是否成功
    await pool.query('SELECT 1');
    console.log('✅ MySQL 数据库连接成功，连接池已就绪');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败，请检查 MySQL 服务是否启动及密码是否正确');
    console.error('错误详情:', error.message);
    throw error; // 抛出错误让 server.js 捕获
  }
}

/**
 * 执行查询并返回多行结果
 * 对应你代码中原本的 all() 逻辑
 */
async function all(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 执行查询并返回单行结果
 * 对应你代码中原本的 get() 逻辑
 */
async function get(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

/**
 * 执行增删改操作
 * 对应你代码中原本的 run() 逻辑
 */
async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  // MySQL 的 insertId 对应 SQLite 的 lastID
  return { 
    lastID: result.insertId, 
    changes: result.affectedRows 
  };
}

// 导出所有函数，确保与 server.js 和各 Routes 文件兼容
module.exports = {
  initDb,
  all,
  get,
  run,
  pool // 备用，如果有地方需要直接操作 pool
};