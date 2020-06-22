require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const ejs = require('ejs');

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

const db = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: 'gc_sa'
});

app.get('/', (req, res) => {
	let sql_qry = "SELECT balance FROM gcash_account";
	db.query(sql_qry, (err, rows) => {
		if(err) throw err;
		// console.log(rows);
		res.render('body', {gCashBal : rows } );
	});
});

app.get('/newtransaction', (req, res) => {


});

app.listen(3000, function(){
	console.log('Server started on port 3000.');
});
