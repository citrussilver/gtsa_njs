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
  multipleStatements: true,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'gc_sa'
});

let alertNotif = '';

app.get('/', (req, res) => {

  dbConnection.query('SELECT balance FROM gcash_account; SELECT balance FROM prepaid_cards WHERE last_4_digits = 7178; SELECT balance FROM banks ', (err, rows) => {
    if (err) throw err;
    res.render('body', {
      gCashBal: rows[0],
      pc7178: rows[1],
      saBal: rows[2]
    });
  });
});

app.get('/viewrecs', (req, res) => {
  // "%a, %Y-%c-%d %H:%i"
  const sel_sql = 'SELECT DATE_FORMAT(date_time,"%a, %b %d, %Y  %H:%i") AS date_time, bt.description as transact_type, FORMAT(amount,2) AS amount, FORMAT(current_balance,2) AS current_balance, remarks, FORMAT(post_transact_balance,2) AS post_transact_balance, location FROM savings_acct_transactions sa JOIN bank_transaction_type bt ON sa.bank_transact_type_id = bt.id';
  dbConnection.query(sel_sql, (err, rows) => {
    if (err) throw err;
    res.render('records', {
      recRows: rows
    });
  });
});

app.get('/new_bt_rec', (req, res) => {
  res.render('new_bt', {
    alertNotif: alertNotif
  });
});

app.post('/new_bt_rec', (req, res) => {
  const bankId = req.body.bankIdDrp;
  let dateTime = req.body.dateTimeFld;
  dateTime = dateTime.replace("T", " ");
  const transactType = req.body.transactTypeDrp;
  const amount = req.body.amountFld;
  const remarks = req.body.remarksTxt;
  const loc = req.body.locFld;

  // console.log(dateTime + ',' + bankName + ',' + transactType + ',' + amount + ',' + remarks + ',' + loc);
  const new_bt_data = {
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
    dbConnection.query('INSERT INTO savings_acct_transactions SET ?', new_bt_data, function(error, results, fields) {
      if (error) {
        return dbConnection.rollback(function() {
          throw error;
        });
      }

      if (Number(transactType) === 1) {
        const depo_data = {
          sa_transact_id: results.insertId,
          remarks: remarks,
          amount: amount
        };

        dbConnection.query('INSERT INTO bank_cash_deposit SET ?', depo_data, function(error, results) {
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
            alertNotif = 'New Cash Deposit successfully posted to database.';
            console.log(alertNotif);
          });
        });
      } else if (Number(transactType) === 2) {
        const wdraw_data = {
          sa_transact_id: results.insertId,
          remarks: remarks,
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
            alertNotif = 'New Cash Withdrawal successfully posted to database.';
            console.log(alertNotif);
          });
        });
      } else if (Number(transactType) === 3) {

        const bbills_data = {
          sa_transact_id: results.insertId,
          remarks: remarks,
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
            alertNotif = 'New Bills Payment successfully posted to database.';
            console.log(alertNotif);
          });
        });
      } else if (Number(transactType) === 4) {
        let saTransactId = results.insertId;

        const cash_in_data = {
          date_time: dateTime,
          transaction_type_id: Number(2),
          amount: amount,
          remarks: remarks,
        };

        dbConnection.query('INSERT INTO gcash_transactions SET ?', cash_in_data, function(error, results) {
          if (error) {
            return dbConnection.rollback(function() {
              throw error;
            });
          }

          const gcash_in_data = {
            gcash_transact_id: results.insertId,
            sa_transact_id: saTransactId,
            remarks: remarks,
            amount: amount
          }

          dbConnection.query('INSERT INTO gcash_cash_in SET ?', gcash_in_data, function(error, results) {
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
              alertNotif = 'New GCash Cash-in successfully posted to database.';
              console.log(alertNotif);
            });
          })
        });
      } else if (Number(transactType) === 5) {
        const bpreload_data = {
          sa_transact_id: results.insertId,
          date_time: dateTime,
          prepaid_card_id: Number(1),
          amount: amount
        };
        dbConnection.query('INSERT INTO bank_prepaid_reload SET ?', bpreload_data, function(error, results) {
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
            alertNotif = 'New Prepaid card reload successfully posted to database.';
            console.log(alertNotif);
          });
        });
      } else if (Number(transactType) === 6) {
        const transfer_data = {
          sa_transact_id: results.insertId,
          bank_id: bankId,
          date_time: dateTime,
          remarks: remarks,
          amount: amount
        };

        dbConnection.query('INSERT INTO bank_transfer_money SET ?', transfer_data, function(error, results) {
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
            alertNotif = 'New Transfer money successfully posted to database.';
            console.log(alertNotif);
          });
        });
      } else if (Number(transactType) === 7) {
        const adjust_data = {
          sa_transact_id: results.insertId,
          bank_id: bankId,
          date_time: dateTime,
          amount: amount,
          credit: Number(0), //0 means debit.. will fix in the future
          remarks: remarks
        };

        dbConnection.query('INSERT INTO bank_adjustment SET ?', adjust_data, function(error, results) {
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
            alertNotif = 'New Bank Adjustment successfully posted to database.';
            console.log(alertNotif);
          });
        });
      } else if (Number(transactType) === 8) {
        const ep_data = {
          sa_transact_id: results.insertId,
          bank_id: bankId,
          date_time: dateTime,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO bank_earn_interest SET ?', ep_data, function(error, results) {
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
            console.log('New bank earn interest successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 9) {
        const tw_data = {
          sa_transact_id: results.insertId,
          bank_id: bankId,
          date_time: dateTime,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO bank_tax_withheld SET ?', tw_data, function(error, results) {
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
            console.log('New tax withheld successfully posted to database.');
          });
        });
      }
      res.redirect('/new_bt_rec');
    }); //INSERT INTO savings_acct_transactions
  });
});

app.get('/new_gt_rec', (req, res) => {
  res.render('new_gt');
});

app.post('/new_gt_rec', (req, res) => {
  let dateTime = req.body.dateTimeFld;
  dateTime = dateTime.replace("T", " ");
  const transactType = req.body.transactTypeDrp;
  const mobile_no = req.body.mbnFld;
  const amount = req.body.amountFld;
  const remarks = req.body.remarksTxt;
  const loc = req.body.locFld;

  const new_gt_data = {
    date_time: dateTime,
    transaction_type_id: transactType,
    amount: amount,
    remarks: remarks
  };

  dbConnection.beginTransaction(function(err) {
    if (err) {
      throw err;
    }
    dbConnection.query('INSERT INTO gcash_transactions SET ?', new_gt_data, function(error, results, fields) {
      if (error) {
        return dbConnection.rollback(function() {
          throw error;
        });
      }

      if (Number(transactType) === 1) {
        const bl_data = {
          gcash_transact_id: results.insertId,
          date_time: dateTime,
          mobile_number: mobile_no,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO buy_load SET ?', bl_data, function(error, results) {
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
            console.log('New buy load successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 3) {
        const gbp_data = {
          gcash_transact_id: results.insertId,
          date_time: dateTime,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO gcash_bills_payment SET ?', gbp_data, function(error, results) {
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
            console.log('New GCash Bills payment successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 4) {
        const income_data = {
          gcash_transact_id: results.insertId,
          date_time: dateTime,
          amount: amount,
          description: remarks
        };

        dbConnection.query('INSERT INTO gcash_income SET ?', income_data, function(error, results) {
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
            console.log('New Income/Sale successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 5) {
        const sbl_data = {
          gcash_transact_id: results.insertId,
          date_time: dateTime,
          mobile_number: mobile_no,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO self_buy_load SET ?', sbl_data, function(error, results) {
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
            console.log('New self buy load successfully posted to database.');
          });
        });
      } else if (Number(transactType) === 6) {
        const stb_data = {
          gcash_transact_id: results.insertId,
          bank_id: 1, //will fix in the future
          date_time: dateTime,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO gcash_send_to_bank SET ?', stb_data, function(error, results) {
          if (error) {
            return dbConnection.rollback(function() {
              throw error;
            });
          }

          const sa_data = {
            bank_id: 1,
            date_time: dateTime,
            bank_transact_type_id: 1, //gcash to bank therefore, deposit
            amount: amount,
            remarks: remarks,
            location: 'GCash App'
          }

          dbConnection.query('INSERT INTO savings_acct_transactions SET ?', sa_data, function(error, results) {
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
              console.log('New send to bank successfully posted to database.');
            });
          });//INSERT INTO gcash_cash_in
        }); //INSERT gcash_send_to_bank
      } else if (Number(transactType) === 7) {
        const glp_data = {
          gcash_transact_id: results.insertId,
          date_time: dateTime,
          amount: amount,
          remarks: remarks
        };

        dbConnection.query('INSERT INTO gcash_lazada_payment SET ?', glp_data, function(error, results) {
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
            console.log('New GCash Lazada payment successfully posted to database.');
          });
        });
      } //Number(transactType) === 7
      res.redirect('/new_gt_rec');
    }); //INSERT INTO gcash_transactions
  }); //dbConnection.beginTransaction()
}); //app.post()

app.listen(7000, function() {
  console.log('Server started on port 7000.');
});
