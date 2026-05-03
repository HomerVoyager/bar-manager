#!/data/data/com.termux/files/usr/bin/bash
mkdir -p ~/logs
pg_ctl -D $PREFIX/var/lib/postgresql status > /dev/null 2>&1 || \
  pg_ctl -D $PREFIX/var/lib/postgresql start -l $PREFIX/var/lib/postgresql/pg.log
sleep 2
cd ~/bar-manager/backend
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ~/logs/backend.log 2>&1 &
cd ~/bar-manager/frontend
nohup npm run dev -- --host 0.0.0.0 --port 3000 > ~/logs/frontend.log 2>&1 &
echo "起動完了"
echo "管理画面: http://localhost:3000"
echo "ログイン: 田中 / admin123"
