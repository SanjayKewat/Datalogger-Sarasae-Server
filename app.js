var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
var matlab_route = require('./routes/matlab_route');//module file for perform restfull operation
var mysql = require('mysql');
var ann_area=require('./routes/ann_area'); // Reading pressure data
var db_confg=require('mysql_dbconfig'),
    connectionpool  = mysql.createPool({
        host: db_confg.DB.host,
        user: db_confg.DB.user,
        password: db_confg.DB.password,
        database: db_confg.DB.database,
        port: db_confg.DB.port

    });

var app = express();

// Create our Express router
// get an instance of router
var router = express.Router();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', __dirname + '/views');         // here is code to spesify the html page directory
app.engine('html', require('ejs').renderFile);  //render html using ejs module


// apply the routes to our application
app.use('/',router);
//Use route middleware to process requests
// route middleware that will happen on every request
router.use(function(req, res, next) {

    // log each request to the console
    console.log('Log each request : ');
    console.log('Method : '+req.method,'Url : '+ req.url);

    // continue doing what we were doing and go to the route
    next();
});




////====>> Fetching data for Fusion chart start =======>>


router.get('/press',ann_area.casing);  //fetch realtime data for Drill pipe & casing pressure


////====>> Fetching data for Fusion chart End=======>>


//START here handling mysql connection when disconnected
function handleDisconnect() {

    connection = mysql.createConnection({
        host: db_confg.DB.host,
        user: db_confg.DB.user,
        password: db_confg.DB.password,
        database: db_confg.DB.database,
        port: db_confg.DB.port
    }),



// If there is an error connecting to the database
    connection.connect(function(err) {
            // connected! (unless `err` is set)
            if(err) {                                     // or restarting (takes a while sometimes).
                console.log('error when connecting to db:', err);
                setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
            }
        });

    connection.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });

};

handleDisconnect();

//END here handling mysql connection when disconnected

//app.use('/', routes);
app.use('/users', users);


app.use('/api/matlab', matlab_route);


router.get('/',function(req, res){
//        console.log('session  exit');
    res.render('choke.html');
});


router.get('/hist',function(req, res){
//        console.log('session  exit');
        res.render('presstrend.html');
});

router.get('/l',function(req, res){
//        console.log('session  exit');
    res.render('live.html');
});


//here calling update_table() every 1 sec
setInterval(function(){
    update_table();

},1000);

//here Function for updating current table Data
function update_table(){

    var getsql="SELECT * FROM matlab_tab order by id desc";
    connectionpool.getConnection(function(err, connection) {
        if (err) {
            console.error('CONNECTION error: ',err);

        } else {

            connection.query(getsql, function(err, rows, fields) {
                if (err) {
                    console.error(err);

                }
                up_fld0=rows[0].field0;
                up_fld1=rows[0].field1;
                up_fld2=rows[0].field2;
                up_fld3=rows[0].field3;
                up_fld4=rows[0].field4;
                up_fld5=rows[0].field5;
                load_tme=rows[0].insert_tmestmp;
                id_prev=rows[0].id;

                var a = new Date(); // Now
                var b = new Date(load_tme); // previous time

                var seconds = Math.round((a-b)/1000);
                console.log('seconds : '+seconds);


                if(seconds>60){ //here condition updating value after 60 seconds
                    curr_sql="update matlab_currnt set con_sec='0',id_prev="+id_prev+",field5='"+up_fld5+"',insert_tmestmp=now() where id=1";
                    cnd=0;
                }
                else
                {
                    curr_sql="update matlab_currnt set field0='"+up_fld0+"',field1='"+up_fld1+"',field2='"+up_fld2+"',field3='"+up_fld3+"',field4='"+up_fld4+"',field5='"+up_fld5+"',id_prev="+id_prev+",con_sec='1',insert_tmestmp=now() where id=1";
                    cnd=1;
                }
                connection.query(curr_sql, function(err, rows, fields) {
                    if (err) {
                        console.error(err);

                    }
                   console.log('matlab_currnt table condtion : '+cnd+' updated successfully');
                    connection.release();
                });
            });
        }
    });
};




// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
