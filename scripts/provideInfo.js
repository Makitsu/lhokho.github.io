$(document).ready(function(){

    var city_id = window.location.search.substr(1).split("=")[1];

    informations = firebase.database().ref("city/info");
    items = firebase.database().ref("city/items");
    beers = firebase.database().ref("city/beer");
    station = firebase.database().ref("city/station")
    weather = firebase.database().ref("city/weather")

    //retrieve general information
    informations.on("value", function(dataset) {
        dataset.forEach(function(childNodes){
            if(childNodes.key === city_id){
                //console.log(childNodes.val());
                $('#background').css({'background-image': 'url(images/city/bg_'+childNodes.key+'.jpg)'});
                getCityInformation(childNodes.val())
            }
        });
    });

    function getCityInformation(data) {
        //console.log('retrieve general information in database')
        $( "#city_welcome" ).append(data["ville"]);
        $( "#city_region" ).append(data["region"]);
        $( "#city_departement" ).append(data["departement"]);
        $( "#city_population" ).append(data["population"]);
        $( "#city_densite" ).append(data["densite"]);
        $( "#city_gentile" ).append(data["gentile"]);
        $( "#city_altitude" ).append(data["altitude"]);
        $( "#city_superficie" ).append(data["superficie"]);
    }

    //retrieve city items if it exists
    let cat = ['monument','lieu','museum','food'];
    items.on("value", function(dataset) {
        let data_list = [];
        dataset.forEach(function(childNodes){
            if(childNodes.key === city_id){
                //console.log(childNodes.val());
                childNodes.forEach(function(item) {
                    var itemVal = item.val();
                    data_list.push(itemVal);
                });
                function func(a, b) {
                    return Math.random();
                }
                data_list = data_list.sort(func);
            }
        });
        getCityItem(data_list);
    });

    function getCityItem(data_list){
        if (data_list !== null && data_list !== undefined && data_list.length > 0) {
            //console.log(data_list)
            cr = 0;
            cat.forEach(function(cat){
                idx = 0;
                ct = 0;
                while(ct < 3 || idx === data_list.length-1){
                    let focus = data_list[idx];
                    if(focus['type'] === cat){
                        //console.log(cat);
                        let str = "img_src_%s".replace('%s',(cr + 1).toString())
                        let str2 = "img_title_%s".replace('%s',(cr + 1).toString())
                        document.getElementById(str).title = focus['name'];
                        document.getElementById(str).onclick = function() {window.open(focus['wiki_link'], '_blank')};
                        document.getElementById(str).src = focus['image_src'];
                        document.getElementById(str2).append(focus['name']);
                        ct = ct + 1;
                        cr = cr + 1;
                    }
                    idx = idx + 1;
                }
            })
            $("#items_container").show();
        } else {
            $("#items-link").hide();
        }
    }

    //retrieve city general beer information if it exists

    beers.on("value", function(dataset) {
        dataset.forEach(function(childNodes){
            if(childNodes.key === city_id){
                //console.log(childNodes.val());
                getCityBars(childNodes.val())
            }
        });
    });

    function getCityBars(data_list){
        if (data_list !== 0) {
            //console.log('beer available')
            //console.log(data_list['price_min_HH'])
            $("#av_HH").append(data_list['average_price_HH'] !== undefined ? data_list['average_price_HH'] : 'N.A.');
            $("#av_nHH").append(data_list['average_price nHH'] !== undefined ? data_list['average_price nHH'] : 'N.A.');
            $("#min_HH").append(data_list['price_min_HH'] !== undefined ? data_list['price_min_HH'] : 'N.A.');
            $("#min_nHH").append(data_list['price_min_nHH'] !== undefined ? data_list['price_min_nHH'] : 'N.A.');
            dict = data_list['ranking']
            if(dict !== 'None'){
                //console.log(dict)
                for (var key in dict) {
                    var value = dict[key];
                    //console.log(value);
                    var key = key;
                    //console.log(key);
                    document.getElementById("ranking").append(key);
                    document.getElementById("ranking").appendChild(document.createElement('br'));
                }
            }else{
                $("#ranking").hide();
                $("#ranking_label").hide();
            }
            $("#beer_container").show();
        }else{
            //console.log('beer unavailable')
            $("#beer_link").hide();
        }
    }

    //Check if weather data already in the database
    let isThereData = false;
    weather.on("value", function(dataset) {
        dataset.forEach(function(childNodes){
           var OneDay = new Date().getTime() + (1 * 24 * 60 * 60 * 1000);
           console.log(childNodes.val());
           if(childNodes.key == city_id && childNodes.last_update < OneDay){
                console.log(childNodes.val());
                PopulateCityWeather(childNodes.val());
                isThereData = true;
           }
        });
    });

    // Nothing found in database or outdated update
    if(!isThereData){
        console.log(station.child(city_id));

        station.on("value", function(dataset) {
            dataset.forEach(function(childNodes){
                if(childNodes.key == city_id){
                    addCityWeather(childNodes.val());
                }
            });

        });

    }

    //retrieve city location (lat,lon) information if it exists and populate the weather
    function PopulateCityWeather(data_list){
     if (data_list !== 0) {
        console.log('location available :  populate weather data from db');
        for (let i = 0; i < 3; i++){
                let wt = "w_%s".replace('%s',(i + 1).toString())
                let wth = "temp_%s".replace('%s',(i + 1).toString())
                let wth2 = "icon_%s".replace('%s',(i + 1).toString())
                let url = 'https://openweathermap.org/img/wn/%s@2x.png'.replace('%s',(data_list[i]['icon']).toString())
                document.getElementById(wt).append(date_list[i]['date']);
                document.getElementById(wth).append(Math.round(data_list[i]['temp']));
                document.getElementById(wth2).src = url;
            }
        }
    }
    function addCityWeather(data_list){
        if (data_list !== 0) {
            console.log('location available :  add weather data');
            var lat = data_list[0]['coords'][1]
            var lon = data_list[0]['coords'][0]
            var url = 'https://api.openweathermap.org/data/2.5/onecall?lat=%lat&lon=%lon&lang=fr&appid=5e0c07d2d939d7a1cbaadf4d6d0ee1bf&units=metric'.replace('%lat',lat.toString()).replace('%lon',lon.toString())
            $.getJSON(url, function(data){
                console.log(data);
                var today = new Date();
                for (let k = 0; k < 3; k++){
                    let date_str = (today.getDate()+k)+'/'+(today.getMonth()+1);
                    let wt = "w_%s".replace('%s',(k + 1).toString())
                    let wth = "temp_%s".replace('%s',(k + 1).toString())
                    let wth2 = "icon_%s".replace('%s',(k + 1).toString())
                    let url = 'https://openweathermap.org/img/wn/%s@2x.png'.replace('%s',(data['daily'][k]['weather'][0]['icon']).toString())
                    document.getElementById(wt).append(date_str);
                    document.getElementById(wth).append(Math.round(data['daily'][k]['temp']['day']));
                    document.getElementById(wth2).src = url;
                    var object = {'date': new Date().getTime(), 'temp' : Math.round(data['daily'][k]['temp']['day']),'icon':url}
                    weather.child(city_id).child(k).set(object).then().catch((error) => {
                        console.error(error);
                    });
                }
            })
        }else{
            console.log('weather unavailable')
            document.getElementById("weather_container").style.display = "none";
        }
    }
});


