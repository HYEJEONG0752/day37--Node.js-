const http = require('http');
const url = require('url');
const fs = require('fs');

const PORT = 11000;
let books =[];
let users = {}; // 간단한 사용자 관리 (이름 : 대출 도서 ID)

const dataFile = 'books.json';

// 데이터 파일 로드
if (fs.existsSync(dataFile)) {
    const data = fs.readFileSync(dataFile);
    books = JSON.parse(data);
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

    if (pathname === '/books') {
        if (req.method === 'GET') {
            const search = query.search ? query.search.toLowerCase() : null;
            let filteredBooks = books;

            if (search) {
                filteredBooks = books.filter(book => 
                    book.title.toLowerCase().includes(search) ||
                    book.author.toLowerCase().includes(search)
                );
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(filteredBooks));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk });
            req.on('end', () => {
                const { title, author, year } = JSON.parse(body);
                const newBook = {
                    id: Date.now(),
                    title,
                    author,
                    year,
                    isBorrowed: false,
                    borrowedBy: null
                };
                books.push(newBook);
                fs.writeFileSync(dataFile, JSON.stringify(books));
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newBook));
            });
        }
    } else if (pathname.startsWith('/books/')) {
        const id = parseInt(pathname.split('/')[2]);
        const bookIndex = books.findIndex(b => b.id === id);
        if (bookIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            req.end(JSON.stringify({ message: 'Book not found' }));

            return;
        }

        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(books[bookIndex]));
        } else if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const updatedData = JSON.parse(body);
                books[bookIndex] = { ...books[bookIndex], ...updatedData };

                fs.writeFileSync(dataFile, JSON.stringify(books));
            });
        } else if (req.method === 'DELETE') {
            books.splice(bookIndex, 1);

            fs.writeFileSync(dataFile, JSON.stringify(books));
            res.writeHead(204);
            res.end();
        }
    } else if (pathname.startsWith('/borrow/')) {
        const id = parseInt(pathname.split('/')[2]);
        const { user } = query;
        const book = books.find(b => b.id === id);

        if (!book) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Book not found' }));

            return;
        }
        if (book.isBorrowed) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Book is already borrowed' }));

            return;
        }
        book.isBorrowed = true;
        book.borrowedBy = user;
        users[user] = id;

        fs.writeFileSync(dataFile, JSON.stringify(books));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Book borrowed by ${user}` }));
    } else if (pathname.startsWith('/return/')) {
        const id = parseInt(pathname.split('/')[2]);
        const book = books.find(b => b.id === id);

        if (!book) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Book not found' }));

            return;
        }
        if (!book.isBorrowed) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Book is not borrowed' }));

            return;
        }
        const user = book.borrowedBy;

        book.isBorrowed = false;
        book.borrowedBy = null;

        delete users[user];

        fs.writeFileSync(dataFile, JSON.stringify(books));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Book returned by ${user}` }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`도서 관리 시스템 API가 http://localhost:${PORT} 에서 실행 중 입니다.`);
});