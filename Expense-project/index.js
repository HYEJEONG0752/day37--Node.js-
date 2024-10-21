const http = require('http');
const url = require('url');
const fs = require('fs');

const PORT = 12000;
let expenses = [];
let categories = ['식비', '교통비', '주거비', '기타'];

const expensesFile = 'expenses.json';
const categoriesFile = 'categories.json';

// 데이터 파일 로드
if (fs.existsSync(expensesFile)) {
    const data = fs.readFileSync(expensesFile);
    expenses = JSON.parse(data);
}

if (fs.existsSync(categoriesFile)) {
    const data = fs.readFileSync(categoriesFile);
    categories = JSON.parse(data);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 지출 관련 라우트
    if (pathname === '/expenses') {
        if (req.method === 'GET') {
            let filteredExpenses = expenses;

            // 카테고리 필터링
            if (query.category) {
                filteredExpenses = filteredExpenses.filter(exp => exp.category === query.category);
            }

            // 날짜 필터링
            if (query.month) {
                filteredExpenses = filteredExpenses.filter(exp => {
                    const expDate = new Date(exp.date);
                    return expDate.getMonth() + 1 === parseInt(query.month);
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(filteredExpenses));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const { amount, category, date, description } = JSON.parse(body);
                if (!categories.includes(category)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid category' }));
                    return;
                }
                const newExpense = {
                    id: Date.now(),
                    amount,
                    category,
                    date,
                    description
                };
                expenses.push(newExpense);
                fs.writeFileSync(expensesFile, JSON.stringify(expenses));
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newExpense));
            });
        }
    } else if (pathname.startsWith('/expenses/')) {
        const id = parseInt(pathname.split('/')[2]);
        const expenseIndex = expenses.findIndex(e => e.id === id);
        if (expenseIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Expense not found' }));
            return;
        }

        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(expenses[expenseIndex]));
        } else if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const updatedData = JSON.parse(body);
                if (updatedData.category && !categories.includes(updatedData.category)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid category' }));
                    return;
                }
                expenses[expenseIndex] = { ...expenses[expenseIndex], ...updatedData };
                fs.writeFileSync(expensesFile, JSON.stringify(expenses));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(expenses[expenseIndex]));
            });
        } else if (req.method === 'DELETE') {
            expenses.splice(expenseIndex, 1);
            fs.writeFileSync(expensesFile, JSON.stringify(expenses));
            res.writeHead(204);
            res.end();
        }
    }

    // 카테고리 관련 라우트
    else if (pathname === '/categories') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(categories));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const { category } = JSON.parse(body);
                if (categories.includes(category)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Category already exists' }));
                    return;
                }
                categories.push(category);
                fs.writeFileSync(categoriesFile, JSON.stringify(categories));
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ category }));
            });
        }
    } else if (pathname.startsWith('/categories/')) {
        const category = pathname.split('/')[2];
        const categoryIndex = categories.indexOf(category);
        if (categoryIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Category not found' }));
            return;
        }

        if (req.method === 'DELETE') {
            // 해당 카테고리에 속한 지출 항목들도 삭제 또는 다른 카테고리로 이동
            expenses = expenses.filter(exp => exp.category !== category);
            categories.splice(categoryIndex, 1);
            fs.writeFileSync(categoriesFile, JSON.stringify(categories));
            fs.writeFileSync(expensesFile, JSON.stringify(expenses));
            res.writeHead(204);
            res.end();
        }
    }

    // 통계 관련 라우트
    else if (pathname === '/statistics' && req.method === 'GET') {
        const month = query.month ? parseInt(query.month) : null;
        if (!month) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Month query parameter is required' }));
            return;
        }

        const monthlyExpenses = expenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate.getMonth() + 1 === month;
        });

        const total = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const byCategory = {};
        monthlyExpenses.forEach(exp => {
            if (!byCategory[exp.category]) {
                byCategory[exp.category] = 0;
            }
            byCategory[exp.category] += exp.amount;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total, byCategory }));
    }

    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`지출 관리 API가 http://localhost:${PORT} 에서 실행 중입니다.`);
});