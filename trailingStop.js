var crypto = require("crypto");
var request = require("request");
var settings = require("./models/setting");
var signal = require("./models/signal");
var ticker = require("./models/ticker");
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});  

// settings.findOne({site : "bitmex1"}, function(error, res){
//     console.log(res);
// })
var obj = { 
    site: 'bitmex1',
    site_type: 'oversee',
    url: 'https://testnet.bitmex.com',
    symbol: 'XBTUSD',
    apiKey: '-2YJMJOGLRMvUgaBD1_KzbLt',
    secreteKey: 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
    leverage: 1,
    margin: 1,
    scriptNo: 302,
    minOrdCost: 2000,
    ordInterval: 1,
    minOrdRate: 50,
    maxOrdRate: 50,
    side: 'short',
    side_num: 1,
    execFlag: true,
    isExiting: false,
    isEntering: false,
    isTrailingStop: true,
    trailingHighRate: 90,
    trailingLowRate: 12,
    trailFeeRate: 0.1,
    entryPrice: 9082,
    highPrice: 9082,
    lowPrice: 8812.5,
}

//long-> exit 예제
setTimeout(trailingStop(8980, obj.entryPrice*0.9, obj.entryPrice*1.1, obj), 1000);


function trailingStop(last_price, lowPrice, highPrice, obj){
    return function(){
        //position(obj, function(isPosition){
            
            //console.log("isPosition :" + isPosition);
            var entryPrice = obj.entryPrice; //진입가격
            var trailingHighRate = obj.trailingHighRate * 0.01; 
            var trailingLowRate = obj.trailingLowRate * 0.01; 
            var trailFee = entryPrice * (obj.trailFeeRate * 0.01);
            var scriptNo = obj.scriptNo;
            var side_num = obj.side_num;
            var alpha = 0;
            
            console.log("highPrice : "+ highPrice);
            console.log("entryPrice : "+ entryPrice);
            console.log("highPrice - entryPrice : "+ (highPrice - entryPrice));
            console.log("trailingHighRate : "+ trailingHighRate);
            console.log("trailFee :"+ trailFee);
            // console.log("val : "+ (highPrice - entryPrice) * trailingHighRate)
            // console.log("entryPrice + val : "+ (entryPrice+val) )
            console.log(obj.side);
            
            //포지션 조회
            if(obj.side === 'long'){//isPosition === 'long'
                alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
                console.log("-----------------long exit--------------");
                console.log("alpha : "+alpha);
                console.log("entryPrice + alpha : "+ (entryPrice + alpha));
                console.log("last_price : "+ (last_price));
                console.log("entryPrice + trailFee : "+ (entryPrice + trailFee));
                if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
                    console.log({scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
                    signal.insertMany({scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
                }
            }else if(obj.side === 'short'){ //isPosition === 'short'
                console.log("-----------------short exit--------------");
                alpha = (entryPrice - lowPrice) * trailingLowRate; //(진입가- 저점가) * 비율
                console.log("alpha : "+alpha);
                console.log("entryPrice - alpha : "+ (entryPrice - alpha));
                console.log("last_price : "+ (last_price));
                console.log("entryPrice - trailFee : "+ (entryPrice - trailFee));
                if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
                    console.log({scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
                    signal.insertMany({scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
                }
            }
            
            //현재포지션 exit, 셋팅 : long -> 롱재진입
            if(obj.side === 'long'){ //isPosition === 'exit' && 
                alpha = (entryPrice - lowPrice) * trailingLowRate; //(진입가- 저점가) * 비율
                console.log("-----------------long entry--------------");
                console.log("alpha : "+alpha);
                console.log("entryPrice - alpha : "+ (entryPrice - alpha));
                console.log("last_price : "+ (last_price));
                console.log("entryPrice - trailFee : "+ (entryPrice - trailFee));
               
                if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
                    console.log({scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "long rentry"});
                    signal.insertMany({scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "long rentry"});
                }
            }else if(obj.side === 'short' ){ //isPosition === 'exit' && 
                alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
                console.log("-----------------short entry--------------");
                console.log("alpha : "+alpha);
                console.log("entryPrice + alpha : "+ (entryPrice + alpha));
                console.log("last_price : "+ (last_price));
                console.log("entryPrice + trailFee : "+ (entryPrice + trailFee));
                if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
                    console.log({scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "short retry"});
                    signal.insertMany({scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "short retry"});
                }
            }
        //});
    }
}




// function trailingStop(){
//     return function(){

       // signal.insertMany({scriptNo : 302 , side : "Buy Exit", side_num : 1, type_log : "trailingStop"});
        // var last_price=0;
        // ticker.findOne({site : 'bitmex',site_type : "oversee"}, function(error, json){
        //     if(error){
        //         console.log(error);
        //         return;
        //     }
        //     console.log(json.last_price);
        //     last_price = json.last_price;
        //     settings.find({execFlag: true, site_type : "oversee", isTrailingStop : true}, function(error, json){
        //         if(error){
        //             console.log(error);
        //             return;
        //         }   

        //         console.log(json);
        //         for(i=0; i<json.length; i++){
        //             var entryPrice = json[i].entryPrice; //진입가격
        //             var highPrice = json[i].highPrice; //고점
        //             var lowPrice = json[i].lowPrice; //저점
        //             var trailingHighRate = json[i].trailingHighRate * 0.01; 
        //             var trailingLowRate = json[i].trailingLowRate * 0.01; 
        //             var trailFee = entryPrice * (json[i].trailFeeRate * 0.01);
        //             var scriptNo = json[i].scriptNo;
        //             var side_num = json[i].side_num;
        //             var alpha = 0;

        //             console.log("highPrice : "+ highPrice);
        //             console.log("entryPrice : "+ entryPrice);
        //             console.log("highPrice - entryPrice : "+ (highPrice - entryPrice));
        //             console.log("trailingHighRate : "+ trailingHighRate);
        //             // console.log("val : "+ (highPrice - entryPrice) * trailingHighRate)
        //             // console.log("entryPrice + val : "+ (entryPrice+val) )
        //             console.log(json[i].side);
        //             if(json[i].side === 'long'){
        //                 alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
        //                 console.log("entryPrice + alpha : "+ (entryPrice + alpha));
        //                 console.log("last_price : "+ (last_price));
        //                 console.log("entryPrice + trailFee : "+ (entryPrice + trailFee));
        //                 if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
        //                     console.log({scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
        //                     //signal.insertMany({scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
        //                 }
        //             }else if(json[i].side === 'short'){
        //                 alpha = (entryPrice - lowPrice) * trailingLowRate; //(고점가 - 진입가) * 비율
        //                 if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
        //                     console.log({scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
        //                     //signal.insertMany({scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
        //                 }
        //             }
        //         }
        //     });
        // });
        
//     }
// }



// signal.insertMany({scriptNo : 302 , side : "Buy Exit", side_num : 1});



