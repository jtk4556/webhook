var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var scriptSchema = new Schema({
    scriptName : {type:String, default : 1},      
    scriptNo : {type:Number, default : 1, unique : true},       
    version : {type:Number, default : 1},
    log : {type:String, default : ""},
    timestamp : {type : Date, default : Date.now}
});
module.exports = mongoose.model('script', scriptSchema,'script');