-- Next.js 应用独立数据库（会员、积分、跑步记录、优惠券）
CREATE DATABASE IF NOT EXISTS msw_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'msw'@'%' IDENTIFIED BY 'msw_app_pw_2026';
GRANT ALL PRIVILEGES ON msw_app.* TO 'msw'@'%';
GRANT SELECT ON wordpress.* TO 'msw'@'%';
FLUSH PRIVILEGES;
