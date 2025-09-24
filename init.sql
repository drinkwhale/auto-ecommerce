-- Auto E-commerce Database Initialization Script

-- Create database (이미 docker-compose.yml에서 생성되지만 확인용)
-- CREATE DATABASE IF NOT EXISTS auto_ecommerce;

-- 한국어 설정을 위한 collation 설정
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 테스트 데이터 준비를 위한 기본 설정
SET timezone = 'Asia/Seoul';

-- Log the initialization
INSERT INTO pg_stat_statements_info (dealloc) VALUES (0) ON CONFLICT DO NOTHING;

-- Database ready message
SELECT 'Auto E-commerce Database initialized successfully' as message;