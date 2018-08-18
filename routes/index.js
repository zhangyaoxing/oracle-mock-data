var express = require('express');
var faker = require('faker');
var config = require('config');
var router = express.Router();
var bluebird = require('bluebird');

router.get('/oracle', function (req, res, next) {
  let pool = req.app.get('pool');
  pool.getConnection((err, conn) => {
    if (err) {
      res.status(500);
      res.json({
        err: err
      });
      return;
    }
    conn.execute(`SELECT TAPDATA.TAPSEQ.nextval FROM DUAL`, {}, {
      autoCommit: true
    }, (err, result) => {
      if (err) {
        res.status(500);
        res.json({
          err: err
        });
        return;
      }

      let orderId = result.rows[0][0];
      conn.execute(`INSERT INTO TAPDATA.ORDERS VALUES (:seq, :street, :city, :state, :country, :zip, :phone, :name, :userid)`, [
        orderId,
        faker.address.streetAddress(),
        faker.address.city(),
        faker.address.state(),
        faker.address.country(),
        faker.address.zipCode(),
        faker.phone.phoneNumber(),
        `${faker.name.firstName()} ${faker.name.lastName()}`,
        faker.random.number(config.app.totalUsers)
      ], {
        autoCommit: true
      }, (err, result) => {
        if (err) {
          res.status(500);
          res.json({
            err: err
          });
          return;
        }
        let sql = `INSERT INTO TAPDATA.ORDER_LINES VALUES(TAPDATA.OLSEQ.nextval, :orderid, :product, :sku, :qty, :price, :crap)`;
        let totalLines = config.mock.lines + faker.random.number(config.mock.random);
        let binds = []
        for(let i = 0; i < totalLines; i++) {
          let doc = {
            orderid: orderId,
            product: faker.commerce.productName(),
            sku: faker.random.number(10000).toString(),
            qty: faker.random.number(100),
            price: faker.commerce.price()
          };
          let crapLoad = config.app.crapLoad - 4 - doc.product.length - doc.sku.length - 4 - 4;
          doc.crap = randomString(crapLoad);
          binds.push(doc);
        }
        conn.executeMany(sql, binds, {
          autoCommit: true
        }, (err, result) => {
          if (err) {
            res.status(500);
            res.json({
              err: err
            });
            return;
          }

          conn.close((err => {
            res.json({
              ok: 1
            });
          }));
        });
      });
    });
  });
});

router.get('/mongo', async function (req, res, next) {
  let client = req.app.get('client');
  let db = client.db();
  let collection = db.collection("orders");
  let doc = {
    street: faker.address.streetAddress(),
    city: faker.address.city(),
    state: faker.address.state(),
    country: faker.address.country(),
    zip: faker.address.zipCode(),
    phone: faker.phone.phoneNumber(),
    name: `${faker.name.firstName()} ${faker.name.lastName()}`,
    userId: faker.random.number(config.app.totalUsers),
    orderLines: []
  }
  let totalLines = config.mock.lines + faker.random.number(config.mock.random);
  for(let i = 0; i < totalLines; i++) {
    let line = {
      product: faker.commerce.productName(),
      sku: faker.random.number(10000).toString(),
      qty: faker.random.number(100),
      price: faker.commerce.price()
    };
    let crapLoad = config.app.crapLoad - 4 - line.product.length - line.sku.length - 4 - 4;
    line.crap = randomString(crapLoad);
    doc.orderLines.push(line);
  }
  try {
    let result = await collection.insertOne(doc);
    res.json({ok: 1});
  } catch(err) {
    res.status(500);
    res.json({err: err});
  }
});

function randomString(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

module.exports = router;