let express = require('express');
let router = express.Router();
let request = require('request');
var rp = require('request-promise');
let colors = require('colors');
var perfy = require('perfy');
var logger = require('./logger');
var config = require('./config.json');

router.get('/activities', function(req, res) {

  let params = req.query;

  getActivities(params)
    .then((result) =>  res.send(result));

});

var getActivities = function() {
  return rp('https://www.strava.com/api/v3/activities?access_token=' + config.access_token)
  .then(function(body) {
    
    let activities = JSON.parse(body);
    let results = [];

    for (var i = 0; i < activities.length; i++) {
      let activity = activities[i];

      results.push({
        name: activity.name,
        distance: activity.distance,
        averageSpeed: round(msToKmH(activity.average_speed)),
      });
    }

    return new Promise(function(resolve) { 
        resolve(results);
    });
  })
  .catch(function (err) {
    logger.error('activities could not be fetched'.red, err);
  });  
}

let round = function(number) {
  return Math.round(number * 100) / 100;
}

let msToKmH = function(speedInMS) {
  return speedInMS * 60 * 60 / 1000;
}

module.exports = router;
