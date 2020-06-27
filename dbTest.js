var mysql = require('mysql');
var connection = mysql.createConnection({
    host: '35.223.208.238',
    user: 'root',
    password: '77ltEBOlaf2O8pzC',
    database: 'botiun'
});

connection.connect();

(async () => {
    await query("SELECT * FROM channel WHERE twitchId = 'devinnash';").then(results => {
        if (results.length <= 0) {
            query("INSERT INTO channel (twitchId) VALUES('devinnash');").then(results => {
                console.log("Inserted");
            }).catch(error => { throw error; });
        } else {
            console.log(results);
        }
    }).catch(error => {
        throw error;
    });

    connection.end();
})();

async function query(queryStr) {
    return new Promise((resolve, reject) => {
        connection.query(queryStr, (error, results, fields) => {
            if (error) reject(error);
            resolve(results);
        });
    })
}