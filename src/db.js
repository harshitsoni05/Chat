const NodeCache = require("node-cache");

module.exports.pairedUser = new NodeCache({ stdTTL: 0, checkperiod: 0 });
module.exports.lostIds = new NodeCache({  checkperiod: 5 });
