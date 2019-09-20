var numeral = require('numeral');
var mongoose = require('mongoose');
var randomFloat = require('random-float');
var crypto = require("crypto");
var request = require("request");
var async = require('async');
const winston = require('winston');
require('winston-daily-rotate-file');
require('date-utils');

var settings = require("../models/setting");
var webSetting = require('../webSetting.json');
var orderDB = require('../models/order');
// var url = 'https://testnet.bitmex.com';
// var apiKey = '-2YJMJOGLRMvUgaBD1_KzbLt'
// var secreteKey = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd';
// var symbol = 'XBTUSD';
var logger;
var logfileName1 = '../log/marginTrade' +'.log'; //로그파일 경로1
var logfileName2 = '../log/marginTrade' +'.debug.log'; //로그파일 경로2
create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});  


// var data = {
//     idx : 1,
//     url : 'https://testnet.bitmex.com',
//     apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
//     secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
//     symbol : 'XBTUSD',
//     goalAmt : 0,
//     totalOrdAmt : 0,
//     openingQty : 0, //진입한 포지션 수량 
//     side : "",
//     minAmtRate : 0.07, //최소주문비율
//     maxAmtRate : 0.09, //최대주문비율
//     isOrdered : false, //주문시도 여부
//     isSuccess : false, //주문성공 여부
//     isContinue : false, //주문분할 계속할지 여부
// }

// setTimeout(divide_exit_bitmex(data), 0);

module.exports = function divide_exit_bitmex(obj){
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey},true);
    return function(){
      async.waterfall([
        function init(cb){
            var data = {
                idx : obj.idx,
                url : obj.url,
                apiKey : obj.apiKey,
                secreteKey : obj.secreteKey,
                symbol : obj.symbol,
                ordInterval : obj.ordInterval,
                minOrdAmt : obj.minOrdAmt,
                goalAmt : obj.goalAmt,
                totalOrdAmt : obj.totalOrdAmt,
                openingQty : 0, //진입한 포지션 수량 
                side : "",
                minAmtRate : obj.minAmtRate,
                maxAmtRate : obj.maxAmtRate, //최대주문비율
                orderID : obj.orderID,
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
            }
            logger.info(" 주문 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function orderCancel(data, cb){
            if(data.idx > 1){
                var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'DELETE','order',
                {orderID : data.orderID});
                request(requestHeader, function(error, response, body){
                    if(error){
                        console.log(error)    
                        //res.send(error);
                        return;
                    }
                    var json = JSON.parse(body);
                    //logger.info("취소성공")
                    //logger.info(body);
                    var remainAmt = json[0].orderQty - json[0].cumQty;
                    data.totalOrdAmt = data.totalOrdAmt - remainAmt;
                    cb(null, data);
                });
            }else{
                cb(null, data);
            }
        },
        function position(data, cb){
            var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','position','');//'currency=XBt'
            request(requestOptions, function(err,response,body){
                if(err) {
                    console.log(err);
                    return;
                }
                //console.log(body);
                var json = JSON.parse(body);
                //console.log(json);
                for(i=0; i<json.length; i++){
                    if(json[i].currentQty > 0 && json[i].symbol==='XBTUSD'){
                        //console.log("매수");
                        data.openingQty = json[i].currentQty; //dollar
                        data.side = "Sell";
                    }else if(json[i].currentQty < 0 && json[i].symbol==='XBTUSD'){
                        //console.log("매도");
                        data.openingQty = Math.abs(json[i].currentQty); //dollar
                        data.side = "Buy";
                    }else{
                        data.openingQty = 0;
                        data.side = "NONE";
                    }

                    if(data.idx === 1){
                        data.goalAmt = data.openingQty;
                    }
                }
                cb(null, data);
            });
        },
        function depth(data, cb){
            var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET', 'orderbook/L2', 'symbol='+data.symbol+'&depth=1');
            request(requestHeader, function(error, response, body){
                if(error){
                    console.log(error);
                    return;
                }
                var json = JSON.parse(body);
                data.sellDepth = {
                    price : json[0].price,//가격-> $ dollar
                    amount : json[0].size,//수량-> $ dollar
                    value :  json[0].size / json[0].price //가치 -> xbt
                }
                data.buyDepth = {
                    price : json[1].price,//가격-> $ dollar
                    amount : json[1].size, //수량-> $ dollar
                    value : json[1].size / json[1].price  //가치 -> xbt
                }
                cb(null, data);
            });
        },
        function calc(data, cb){
            var rate = fixed2(randomFloat(data.minAmtRate, data.maxAmtRate));
            var ordAmount=0;
            var remainValue=0;
            if(data.side === 'NONE'){
                logger.info("NONE");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                return cb(null, data);
            }
            else if(data.side === 'Buy'){
                logger.info("Buy");
                
                data.ordAmount = Math.floor(data.sellDepth.amount * rate); //주문수량
                data.ordPrice = data.sellDepth.price; //주문 가격
                data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
               

                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
                
            }else if(data.side === 'Sell'){
                logger.info("Sell");
                data.ordAmount = Math.floor(data.buyDepth.amount * rate); //주문수량
                data.ordPrice = data.buyDepth.price; //주문 가격
                data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }
            
            //최소주문수량 > 주문수량 
            if(data.minOrdAmt > data.ordAmount){
                data.ordAmount = data.minOrdAmt; //최소주문수량으로 주문
            }
            
            //포지션수량 < 주문수량
            if(data.openingQty < data.ordAmount){
                logger.info("포지션수량 < 주문수량");
                data.ordAmount = data.openingQty;
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문X
            }

            

            cb(null, data); //주문X
        },
        function order(data, cb){
            if(data.isOrdered === false){
                return cb(null, data); //주문X
            }

            var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'POST','order',
                                    {symbol : data.symbol, side : data.side, price : data.ordPrice, orderQty : data.ordAmount, ordType : "Limit", text : "auto"});
            request(requestHeader, function(error, response, body){
                if(error){
                    console.log(error)
                    return cb(null, data);
                }
                
                //console.log("주문1 : " + body);
                var json = JSON.parse(body);
                logger.info(data.idx+". site : bitmex " + "/ side : " + json.side + "/ price : " + price_comma(json.price) + "/ amount : "+ amount_comma(json.orderQty) );
                data.orderID = json.orderID; //취소위해 주문ID저장
                data.totalOrdAmt += data.ordAmount;
                data.isSuccess = true; //주문O
                cb(null, data);
            });
        }
      ],function(error, data){
        if(error){
            console.log(error);
            logger.info("분할주문종료");
            switchOnOff(data, false);
            return;
        }
        logger.info("idx : " +data.idx);
        // logger.info("goalAmt : " +data.goalAmt);
        // logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("goalAmt : " +data.goalAmt);
        logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("ordAmount : " +data.ordAmount);
        logger.info("isOrdered : " +data.isOrdered);
        logger.info("isSuccess : " +data.isSuccess);
        logger.info("isContinue : " +data.isContinue);
        logger.info();
        if(data.isContinue === true){ //분할주문 가능
            data.idx += 1;
            setTimeout(divide_exit_bitmex(data), data.ordInterval);//분할주문
            return;
        }else{
            logger.info("분할주문종료");
            switchOnOff(data, false);
            return;
        }
      });
    }
  }

function switchOnOff(data, isOnOff){
    //탈출중 플래그 ON
    //수정된 원화가치 저장
    // settings_v2.updateOne({currency : order_currency + "_" + payment_currency}, {$set : {changed_krw : changed_krw}},function(err, json){
    //     if(err){
    //         console.log(err);
    //         return;
    //     }
    //     console.log("changed_krw 업데이트");
    // });
    settings.updateOne({
        site : "bitmex"
    },{
        $set : {
            isExiting : isOnOff 
        }
    },function(error, res){
        if(error){
            logger.info(error);
            return;
        }
        console.log(res);
    });
}

function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
    path = '/api/v1/'+ endpoint;
    expires = new Date().getTime() + (60 * 1000); // 1 min in the future
    var requestOptions;
    if(verb === 'POST' || verb === 'PUT' || verb === 'DELETE'){
        var postBody = JSON.stringify(data);
        var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
        var headers = {
            'content-type' : 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': apiKey,
            'api-signature': signature
        };
        requestOptions = {
            headers: headers,
            url: url+path,
            method: verb,
            body: postBody
        };
    }else{ //'GET'
        var query = '?'+ data;
        var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + query + expires).digest('hex');
        var headers = {
          'content-type' : 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'api-expires': expires,
          'api-key': apiKey,
          'api-signature': signature
        };
        requestOptions = {
            headers: headers,
            url: url+path + query,
            method: verb
        };
    }
    return requestOptions;
}
  

function fixed4(num){
    var str = new String(num);
    var arr = str.split(".");
	if(arr.length>1){
		    var str2 = arr[1].slice(0,4);
    	return Number(arr[0] + '.' + str2);	
	}
	return Number(arr[0])
}


function fixed2(num){
    var str = new String(num);
    var arr = str.split(".");
    if(arr.length>1){
        var str2 = arr[1].slice(0,2);
        return Number(arr[0] + '.' + str2);	
    }
    return Number(arr[0]);
}

function price_comma(num){
    var price = Number(num)
    if(price < 100){ //가격이 100원보다 작으면 ',' 표시 안하고 그대로 출력
        return price;
    }else{ //가격이 100원보다 크면 ',' 표시 
        return numeral(price).format( '₩0,0' )
    }  
  }
  
  function amount_comma(num){
    var coin = Number(num);
    if(coin >= 0.000001){
        return numeral(coin).format( '₩0,0.0000' ); // 1000.00000123 =>  1,000.00000123
    }else{
        return coin.toFixed(4); // 0.00000078 -> 0.00000078
    }
  }


/**
 * 
 * @param {String} info 레벨 로그 logfileName1 
 * @param {String} debug 레벨 로그 logfileName2 
 */
function create_logger(logfileName1, logfileName2, callback){
    var handle =  winston.createLogger({
        level: 'debug', // 최소 레벨
        // 파일저장
        transports: [
            new winston.transports.DailyRotateFile({
                level : 'info',
                filename : logfileName1, // log 폴더에 system.log 이름으로 저장
                zippedArchive: false, // 압축여부
                maxFiles: '14d',
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            }),
    
            new winston.transports.DailyRotateFile({
                filename : logfileName2, // log 폴더에 system.log 이름으로 저장
                zippedArchive: false, // 압축여부
                maxFiles: '14d',
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            }),
            // 콘솔 출력
            new winston.transports.Console({
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            })
        ]
    });
  
    callback(handle);
  }