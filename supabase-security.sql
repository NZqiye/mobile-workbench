-- 适用于仅由本项目服务端 service_role 读写的个人数据库。
-- 在自己的 Supabase SQL Editor 执行；不适用于与其他前端共用的业务表。
-- 只调整访问权限，不修改或删除记录。推送表尚未创建时跳过。
begin;
alter table public.workbench_records enable row level security;
revoke all on table public.workbench_records from public, anon, authenticated;
grant select, insert, update, delete on table public.workbench_records to service_role;

do $$
begin
  if to_regclass('public.push_subscriptions') is not null then
    alter table public.push_subscriptions enable row level security;
    revoke all on table public.push_subscriptions from public, anon, authenticated;
    grant select, insert, update, delete on table public.push_subscriptions to service_role;
  end if;
end $$;
commit;

-- 验证：两张业务表 RLS 应为 true，anon/authenticated/public 应无表级读写权限。
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('workbench_records', 'push_subscriptions');
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('workbench_records', 'push_subscriptions')
order by table_name, grantee, privilege_type;
-- 若已有列级授权或 SECURITY DEFINER 函数/RPC，还需单独检查，表级撤权不覆盖这些入口。
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('workbench_records', 'push_subscriptions')
  and grantee in ('PUBLIC', 'anon', 'authenticated');
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('workbench_records', 'push_subscriptions');
