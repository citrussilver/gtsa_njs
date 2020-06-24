require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const ejs = require('ejs');

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'gc_sa'
});

app.get('/', (req, res) => {
  const sel_sql = 'SELECT balance FROM gcash_account';
  dbConnection.query(sel_sql, (err, rows) => {
    if (err) throw err;
    res.render('body', {
      gCashBal: rows
    });
  });
});

app.get('/viewrecs', (req, res) => {
  const sel_sql = 'SELECT date_time, bt.description as transact_type, FORMAT(amount,2) AS amount, FORMAT(current_balance,2) AS current_balance, remarks, FORMAT(post_transact_balance,2) AS post_transact_balance, location FROM savings_acct_transactions sa JOIN bank_transaction_type bt ON sa.bank_transact_type_id = bt.id';
  dbConnection.query(sel_sql, (err, rows) => {
    if (err) throw err;
    res.render('records', {recRows: rows});
  });
});

app.get('/newrec', (req, res) => {
  res.render('new');
});

app.post('/newrec', (req, res) => {
  const bankId = req.body.bankIdDrp;
  let dateTime = req.body.dateTimeFld;
  dateTime = dateTime.replace("T", " ");
  const transactType = req.body.transactTypeDrp;
  const amount = req.body.amountFld;
  const remarks = req.body.remarksTxt;
  const loc = req.body.locFld;



  // console.log(dateTime + ',' + bankName + ',' + transactType + ',' + amount + ',' + remarks + ',' + loc);
  let newrec = {
    bank_id: bankId,
    date_time: dateTime,
    bank_transact_type_id: transactType,
    amount: amount,
    remarks: remarks,
    location: loc
  };

  // console.log(newrec);

  dbConnection.beginTransaction(function(err) {
    if (err) {
      throw err;
    }
    let sa_query = dbConnection.query('INSERT INTO savings_acct_transactions SET ?', newrec, function(error, results, fields) {
      if (error) {
        return dbConnection.rollback(function() {
          throw error;
        });
      }

      if (Number(transactType) === 2) {
        let wdraw_data = {
          sa_transaction_id: results.insertId,
          description: remarks,
          amount: amount
        };

        dbConnection.query('INSERT INTO bank_cash_withdraws SET ?', wdraw_data, function(error, results) {
          if (error) {
            return dbConnection.rollback(function() {
              throw error;
            });
          }
          dbConnection.commit(function(err) {
            if (err) {
              return dbConnection.rollback(function() {
                throw err;
              });
            }
            console.log('New Cash withdrawal successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 3) {

        let bbills_data = {
          sa_transaction_id: results.insertId,
          description: remarks,
          amount: amount
        };

        dbConnection.query('INSERT INTO bank_bills_payment SET ?', bbills_data, function(error, results) {
          if (error) {
            return dbConnection.rollback(function() {
              throw error;
            });
          }
          dbConnection.commit(function(err) {
            if (err) {
              return dbConnection.rollback(function() {
                throw err;
              });
            }
            console.log('New Bills payment successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 4) {

        let cashIn_data = {
          sa_transaction_id: results.insertId,
          date_time: dateTime,
          transaction_type_id: 2,
          remarks: remarks,
        };

        dbConnection.query('INSERT INTO gcash_transactions SET ?', cashIn_data, function(error, results) {
          if (error) {
            return dbConnection.rollback(function() {
              throw error;
            });
          }

          let gCashIn_data = {
            gcash_transaction_id: results.insertId,
            description: remarks,
            amount: amount
          }

          dbConnection.query('INSERT INTO gcash_cash_in SET ?', gCashIn_data, function(error, results) {
            if (error) {
              return connection.rollback(function() {
                throw error;
              });
            }
            dbConnection.commit(function(err) {
              if (err) {
                return dbConnection.rollback(function() {
                  throw err;
                });
              }
              console.log('New GCash Cash-in successfully posted to database.');
            });
          })
        });
      }
      res.redirect('/viewrecs');
    });
    // console.log(sa_query.sql);
  });

});

app.listen(3000, function() {
  console.log('Server started on port 3000.');
});
