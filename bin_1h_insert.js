var bid_1h = require('./models/bid_1h');
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');
mongoose.connect(webSetting.dbPath);

var json = { 
    timestamp: '2019-12-12T08:00:00.000Z',
    symbol: 'XBTUSD',
    open: 7217.5,
    high: 7230,
    low: 7217.5,
    close: 7222,
    trades: 1135,
    volume: 517266,
    vwap: 7224.3895,
    lastSize: 1,
    turnover: 7160373548,
    homeNotional: 71.60373547999998,
    foreignNotional: 517266 
}


var obj = {
    symbol : json.symbol,
    timestamp : new Date(json.timestamp).getTime() + (1000 * 60 * 60 * 8),
    open : json.open,
    high : json.high,
    low : json.low,
    close : json.close,
    trades : json.trades,
    volume : json.volume,
    vwap : json.vwap,
    lastSize : json.lastSize,
    turnover : json.turnover,
    homeNotional : json.homeNotional,
    foreignNotional : json.foreignNotional,
    sma1 : 0,
    sma2 : 0,
    sma3 : 0,
    sma4 : 0,
    sma5 : 0,
    ema : 0,
}

setTimeout(update_bin1h(obj), 1000);

function update_bin1h(obj){
    return function(){
        bid_1h.find({}).sort({timestamp : 'desc'}).limit(339).exec(function(error, json){
            if(error){
                console.log(error);
                return;
            }
            //console.log(json);
            var list = new Object(json);
            
            list.unshift(new Object(obj));
            var standard = "low"
            // console.log(json[0])
            // console.log(json[1])
            // console.log(json[2])
            // console.log(json[3])
            var t1 = obj.timestamp;
            var t2 = new Date(json[1].timestamp).getTime();
            // console.log("t1 : "+ new Date(t1).toISOString());
            // console.log("t2 : "+ new Date(t2).toISOString());
            if(checkUsefulData(list)){
                console.log("1시간차이 -> sma, ema 계산")
                obj["sma1"] = getSMA8(list, 0, standard);
                obj["sma2"] = getSMA26(list, 0, standard);
                obj["sma3"] = getSMA54(list, 0, standard);
                obj["sma4"] = getSMA90(list, 0, standard);
                obj["sma5"] = getSMA340(list, 0, standard);
                obj["ema"] = getEMA340(list, 0, standard, list[1].ema);
            }
            bid_1h.findOneAndUpdate(
                {timestamp : obj.timestamp},
                {$set : obj},
                {upsert : true},
                function(error, body){
                    if(error){
                        console.log(error);
                        return;
                    }
                    //console.log(body);
                    console.log("bid update : " + new Date(obj.timestamp).toISOString());
                }
            )
        });
    }
}

function checkUsefulData(list){
    if(list.length !== 340){
        return false;
    }

    var t1 = list[0].timestamp;
    var t2 = 0;
    for(var i=1; i<list.length; i++){
        t2 = new Date(list[i].timestamp).getTime();
        if((t1 - t2) !== (1000 * 60 * 60)){ //최근분봉 - DB최신분봉 === 1시간차
              return false;
        }
        t1 = t2;
    }
    return true;
}

function getSMA8(list, idx, standard){
    if((idx+7) > (list.length-1)){
        return 0;
    }
    var beforeTime = 0;
    var sma =0;
    for(var i=idx; i<=idx+7; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 8).toFixed(11));
    //return fixed1(sma / 8);
}


function getSMA26(list, idx, standard){
    if(idx+25 > list.length-1){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+25; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 26).toFixed(11));
    //return fixed1(sma / 26);
}

function getSMA54(list, idx, standard){
    if( idx+53 > list.length-1 ){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+53; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 54).toFixed(11));
    //return fixed1(sma / 54);
}

function getSMA90(list, idx, standard){
    if( idx+89 > list.length-1 ){
        return 0;
    }

    var sma =0;
    for(var i=idx; i<=idx+89; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 90).toFixed(11));
    //return fixed1(sma / 90);
}


function getSMA340(list, idx, standard){
    if(idx+339 > list.length-1){
        return 0;
    }

    var sma =0;
    for(var i=idx; i<=idx+339; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 340).toFixed(11));
    //return fixed1(sma / 340);
}

function getEMA340(list, idx, standard, beforeEMA){
    ema = ((list[idx][standard] - beforeEMA) * (2/(340+1))) + beforeEMA;
    return Number(Number(ema).toFixed(11));
}