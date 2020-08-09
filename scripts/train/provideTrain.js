// Global variable to store tgv max trip
var last_checked_time = undefined;
var last_checked_return = undefined;
var last_checked_trip_type = undefined;
var last_checked_trip_time = undefined;
var last_checked_journey_type = undefined;
var trips = [];
var stations = [];

$(document).ready(function(){
    station = firebase.database().ref("city/station");
    //default loading of next day trip
    var currentTime = new Date();
    currentTime.setDate(currentTime.getDate() + 1)
    station.once("value", function (dataset) {
        stations = dataset.val();
    }).then(function(){
        setTimeout(function () {
            getTrainRecords(buildQueryDate(currentTime));
        }, 500);
        
        //update trip on date change (MOVE TO GENERALMAP.JS)
        $('#selected_date').change(async function() {});
    });
});

// Get API SNCF records
async function getTrainRecords(date) {
    trips = [];
    last_checked_time = date;
    console.log("enter getTrainRecords method");
    var query = 'https://data.sncf.com/api/records/1.0/search/?dataset=tgvmax' +
        '&q=&rows=10000&sort=date&refine.od_happy_card=OUI' +
        '&refine.date=%date'.replace('%date', date); //format: YYYY-MM-DD
    $.ajaxSetup({
        async: false
    });
    $.getJSON(query, function (response) {
        response['records'].forEach(function(result){
            let trip = {};   
            //define trip date
            trip.day = result.fields.date;
            //gather departure data
            let departure_station = stations.reduce(function(acc, curr, index) {
                curr.forEach(function(stat){
                    if (stat.iata_code == result.fields.origine_iata) {
                        trip.departure_id = index;
                        acc.push(stat);
                    }
                })
                return acc;
            }, [])[0];
            if(typeof departure_station !== 'undefined'){
                trip.departure_city = departure_station.city;
                trip.departure_coords = [departure_station.lat, departure_station.lon];
                trip.departure_iata = result.fields.origine_iata;
                trip.departure_time = result.fields.heure_depart;
                //gather arrival data
                let arrival_station = stations.reduce(function(acc, curr, index) {
                    curr.forEach(function(stat){
                        if (stat.iata_code === result.fields.destination_iata) {
                            trip.arrival_id = index;
                            acc.push(stat);
                        }
                    })
                    return acc;
                }, [])[0];
                if(typeof arrival_station !== 'undefined'){
                    trip.arrival_city = arrival_station.city;
                    trip.arrival_iata = result.fields.destination_iata;
                    trip.arrival_coords = [arrival_station.lat, arrival_station.lon];
                    trip.arrival_iata = result.fields.destination_iata;
                    trip.arrival_time = result.fields.heure_arrivee;
                    //additional trip info
                    trip.duration = calculateDuration(result.fields.heure_depart,result.fields.heure_arrivee);
                    trip.nbStop = 0;
                    trips.push(trip);
                } else {console.log('Missing Arrival Station in DataBase : ', result.fields.destination_iata, ' - ', result.fields.destination)};
            } else {console.log('Missing Departure Station in DataBase : ', result.fields.origine_iata, ' - ', result.fields.origine,' - ', result.fields.code_equip, ' - ', result.fields.axe) };
        });
        return trips;
    });
};


async function getReturnRecords(date) {
    return_base = [];
    last_checked_return = date;
    console.log("enter getTrainRecords method");
    var query = 'https://data.sncf.com/api/records/1.0/search/?dataset=tgvmax' +
        '&q=&rows=10000&sort=date&refine.od_happy_card=OUI' +
        '&refine.date=%date'.replace('%date', date) //format: YYYY-MM-DD
    console.log(query)
    $.ajaxSetup({
        async: false
    });
    $.getJSON(query, function (response) {
        response['records'].forEach(function(result){
            let ret = {};
            //define trip date
            ret.day = result.fields.date;
            //gather departure data
            let departure_station = stations.reduce(function(acc, curr, index) {
                curr.forEach(function(stat){
                    if (stat.iata_code == result.fields.origine_iata) {
                        ret.departure_id = index;
                        acc.push(stat);
                    }
                })
                return acc;
            }, [])[0];
            if(typeof departure_station !== 'undefined'){
                ret.departure_city = departure_station.city;
                ret.departure_coords = [departure_station.lat, departure_station.lon];
                ret.departure_iata = result.fields.origine_iata;
                ret.departure_time = result.fields.heure_depart;
                //gather arrival data
                let arrival_station = stations.reduce(function(acc, curr, index) {
                    curr.forEach(function(stat){
                        if (stat.iata_code === result.fields.destination_iata) {
                            ret.arrival_id = index;
                            acc.push(stat);
                        }
                    })
                    return acc;
                }, [])[0];
                if(typeof arrival_station !== 'undefined'){
                    ret.arrival_city = arrival_station.city;
                    ret.arrival_iata = result.fields.destination_iata;
                    ret.arrival_coords = [arrival_station.lat, arrival_station.lon];
                    ret.arrival_iata = result.fields.destination_iata;
                    ret.arrival_time = result.fields.heure_arrivee;
                    //additional trip info
                    ret.duration = calculateDuration(result.fields.heure_depart,result.fields.heure_arrivee);
                    ret.nbStop = 0;
                    return_base.push(ret);
                } else {console.log('Missing Arrival Station in DataBase : ', result.fields.destination_iata, ' - ', result.fields.destination)};
            } else {console.log('Missing Departure Station in DataBase : ', result.fields.origine_iata, ' - ', result.fields.origine,' - ', result.fields.code_equip, ' - ', result.fields.axe) };
        });
        console.log(return_base)
        return return_base;

    });
};

function findTripsFromDepartureID(departure_id){
    return trips.filter(trip => trip.departure_id == departure_id);
}

function findTripsFromArrivalIata(arrival_iata){
    return trips.filter(trip => trip.arrival_iata == arrival_iata);
}

function findTrips(departure_iata,arrival_iata,nbStop){
    return trips.filter(trip => trip.departure_iata == departure_iata
        && trip.arrival_iata == arrival_iata
        && trip.nbStop == nbStop);
}

//Get connections (One way)
async function getCityConnections(date, marker,trip_type,time_restriction) {
    //retrieve relevant data
    let departure_id = marker.options.id;
    let direct_only = trip_type;
    //get direct trip
    let trips = findTripsFromDepartureID(departure_id);
    console.log(time_restriction);
    if (time_restriction != "unknown_trip" ) {trips = trips.filter(trip => trip.duration <= time_restriction)};
    var destination_list = [];
    trips.forEach(function(trip){
    let isIn = destination_list.includes(trip.arrival_id);
    if (isIn == false) {
            destination_list.push(trip.arrival_id);
            // console.log(destination_list)
    }});
    // get non direct trip if allowed
    if (direct_only === "indirect") {
       let all_indirect_trips = [];
       destination_list.forEach( await function(destination) {
       let indirect_trips = findTripsFromDepartureID(destination).filter(trip => trip.arrival_id != destination);
       let current = trips.filter(trip => trip.arrival_id == destination);
       current.forEach(function (trip) {
       let [hours, minutes] = trip.arrival_time.split(':');
       let dt1 = new Date();
       dt1.setHours(+hours);
       dt1.setMinutes(minutes);
       indirect_trips.forEach(function(indirect_trip){
            // Check if no better direct alternative
            let dt2 = new Date();
            let [hours, minutes] = indirect_trip.departure_time.split(':');
            dt2.setHours(+hours);
            dt2.setMinutes(minutes);
            // Difftime is the connection time
            let Difftime = Math.round((dt2.getTime() - dt1.getTime()) / 60000);
            if (Difftime > 10 && Difftime < 90) {
                   let dt3 = new Date();
                   let [hours, minutes] = indirect_trip.arrival_time.split(':');
                   dt3.setHours(+hours);
                   dt3.setMinutes(minutes);
                   let check = trips.filter(trip => trip.arrival_id == indirect_trip.arrival_id);
                   // console.log(check);
                   let alternative = false;
                   for (let i in check) {
                        let dt4 = new Date();
                        let [hours, minutes] = check[i].arrival_time.split(':');
                        dt4.setHours(+hours);
                        dt4.setMinutes(minutes);
                        if ((Math.abs(dt3.getTime() - dt4.getTime()) < 3600000)) {
                        // console.log('Better alternative found - Exit loop');
                        // console.log('alternative directe existante à : ', check[i].departure_city, '-', check[i].arrival_city, ' ', check[i].departure_time, '-', check[i].arrival_time, ' au lieu de : ', trip.departure_city, '-', indirect_trip.departure_city, '-', indirect_trip.arrival_city , ' ', trip.departure_time, '-', trip.arrival_time, '-', indirect_trip.departure_time, '-', indirect_trip.arrival_time);
                        alternative = true;
                        };
                        // console.log(alternative)
                        };
                        if (alternative == false) {
                        indirect_trip.origine = trip.departure_city;
                        indirect_trip.origine_id = trip.departure_id;
                        indirect_trip.origine_iata = trip.departure_iata;
                        indirect_trip.origine_departure = trip.departure_time;
                        indirect_trip.connection_arrival = trip.arrival_time;
                        indirect_trip.connection_iata = trip.arrival_iata;
                        indirect_trip.full_duration = indirect_trip.duration + trip.duration + Difftime;
                        indirect_trip.connection_time = Difftime;
                        if (time_restriction != "unknown_trip" ) {if (indirect_trip.full_duration <= time_restriction){all_indirect_trips.push(indirect_trip)}} else {all_indirect_trips.push(indirect_trip);};
                        // console.log(indirect_trip.arrival_city, ' depuis ', indirect_trip.departure_city, ' ', trip.departure_time,'-',trip.arrival_time,'-',indirect_trip.departure_time,'-',indirect_trip.arrival_time)
                        };
                   };
                   });
                   });
                   });
                   // console.log(all_indirect_trips);
                   await drawDirectTrip(trips);
                   await drawIndirectTrip(all_indirect_trips,destination_list)} else {await drawDirectTrip(trips)};
                   // $('#sidebar').toggleClass('active');
                   // $('#sidebarCollapse').on('click', function () {
                   // $('#sidebar').toggleClass('active');
                   // });
            };

async function getRoundTrip(marker, trip_type, time_restriction, return_option) {
    //retrieve relevant data
    let departure_id = marker.options.id;
    let departure_iata = marker.options.iata;
    let direct_only = trip_type;
    //get direct trip
    let trips = findTripsFromDepartureID(departure_id);
    if (time_restriction != "unknown_trip" ) {trips = trips.filter(trip => trip.duration <= time_restriction)};
    var destination_list = [];
    trips.forEach(function(trip){
    let isIn = destination_list.includes(trip.arrival_id);
    if (isIn == false) {
            destination_list.push(trip.arrival_id);
            // console.log(destination_list)
    }});
    // get non direct trip if allowed
    if (direct_only == 'indirect') {
       var all_indirect_trips = [];
       destination_list.forEach( await function(destination) {
       let indirect_trips = findTripsFromDepartureID(destination).filter(trip => trip.arrival_id != destination);
       let current = trips.filter(trip => trip.arrival_id == destination);
       current.forEach(function (trip) {
       let [hours, minutes] = trip.arrival_time.split(':');
       let dt1 = new Date();
       dt1.setHours(+hours);
       dt1.setMinutes(minutes);
       indirect_trips.forEach(function(indirect_trip){
            // Check if no better direct alternative
            let dt2 = new Date();
            let [hours, minutes] = indirect_trip.departure_time.split(':');
            dt2.setHours(+hours);
            dt2.setMinutes(minutes);
            // Difftime is the connection time
            let Difftime = Math.round((dt2.getTime() - dt1.getTime()) / 60000);
            if (Difftime > 10 && Difftime < 90) {
                   let dt3 = new Date();
                   let [hours, minutes] = indirect_trip.arrival_time.split(':');
                   dt3.setHours(+hours);
                   dt3.setMinutes(minutes);
                   let check = trips.filter(trip => trip.arrival_id == indirect_trip.arrival_id);
                   // console.log(check);
                   let alternative = false;
                   for (let i in check) {
                        let dt4 = new Date();
                        let [hours, minutes] = check[i].arrival_time.split(':');
                        dt4.setHours(+hours);
                        dt4.setMinutes(minutes);
                        if ((Math.abs(dt3.getTime() - dt4.getTime()) < 3600000)) {
                        // console.log('Better alternative found - Exit loop');
                        // console.log('alternative directe existante à : ', check[i].departure_city, '-', check[i].arrival_city, ' ', check[i].departure_time, '-', check[i].arrival_time, ' au lieu de : ', trip.departure_city, '-', indirect_trip.departure_city, '-', indirect_trip.arrival_city , ' ', trip.departure_time, '-', trip.arrival_time, '-', indirect_trip.departure_time, '-', indirect_trip.arrival_time);
                        alternative = true;
                        };
                        // console.log(alternative)
                        };
                        if (alternative == false) {
                        indirect_trip.origine = trip.departure_city;
                        indirect_trip.origine_id = trip.departure_id;
                        indirect_trip.origine_iata = trip.departure_iata;
                        indirect_trip.origine_departure = trip.departure_time;
                        indirect_trip.connection_arrival = trip.arrival_time;
                        indirect_trip.connection_iata = trip.arrival_iata;
                        indirect_trip.full_duration = indirect_trip.duration + trip.duration + Difftime;
                        indirect_trip.connection_time = Difftime;
                        if (time_restriction != "unknown_trip" ) {if (indirect_trip.full_duration <= time_restriction){all_indirect_trips.push(indirect_trip);}} else {all_indirect_trips.push(indirect_trip);};
                        // console.log(indirect_trip.arrival_city, ' depuis ', indirect_trip.departure_city, ' ', trip.departure_time,'-',trip.arrival_time,'-',indirect_trip.departure_time,'-',indirect_trip.arrival_time)
                        };
                   };
                   });
                   });
                   });
                   // Concatenate all direct/indirect destination for return calculation
                   var temp_destination_list = destination_list;
                   all_indirect_trips.forEach(function(trip){
                    let isIn = destination_list.includes(trip.arrival_id);
                    if (isIn == false) {
                    destination_list.push(trip.arrival_id);
                    }})
                    };

            let oneday_trips = [];
            if (return_option == 'short_journey') {
            destination_list.forEach(function (destination) {
            let first_legs = trips.filter(trip => trip.arrival_id == destination)
            let second_legs = findTripsFromDepartureID(destination).filter(trip => trip.arrival_id == departure_id);
            if (time_restriction != "unknown_trip" ) {second_legs = second_legs.filter(trip => trip.duration <= time_restriction)};
            first_legs.forEach(function (first_leg) {
                let [hours, minutes] = first_leg.arrival_time.split(':');
                let dt1 = new Date();
                dt1.setHours(+hours);
                dt1.setMinutes(minutes);
                second_legs.forEach(function (second_leg) {
                let [hours, minutes] = second_leg.departure_time.split(':');
                let dt2 = new Date();
                dt2.setHours(+hours);
                dt2.setMinutes(minutes);
                let TravelTime = Math.round((dt2.getTime() - dt1.getTime()) / 60000);
                if (TravelTime >= 120 ) {
                        first_leg.sl_departure_id = second_leg.departure_id;
                        first_leg.sl_departure_iata = second_leg.departure_iata;
                        first_leg.sl_departure_time = second_leg.departure_time;
                        first_leg.sl_arrival_id = second_leg.arrival_id;
                        first_leg.sl_arrival_iata = second_leg.arrival_iata;
                        first_leg.sl_arrival_time = second_leg.arrival_time;
                        first_leg.sl_duration = second_leg.duration;
                        first_leg.travel_time = first_leg.duration + second_leg.duration;
                        first_leg.time_on_site = TravelTime;
                        oneday_trips.push(first_leg);
                }
                })
            })
            });
            drawOneDayTrip(oneday_trips);
            }
            else {if(return_option == 'medium_journey') {
            destination_list.forEach(function (destination) {
            let first_legs = trips.filter(trip => trip.arrival_id == destination)
            let second_legs = findTripsFromDepartureID(destination).filter(trip => trip.arrival_id == departure_id);
            if (time_restriction != "unknown_trip" ) {second_legs = second_legs.filter(trip => trip.duration <= time_restriction)};
            first_legs.forEach(function (first_leg) {
                let [hours, minutes] = first_leg.arrival_time.split(':');
                let dt1 = new Date();
                dt1.setHours(+hours);
                dt1.setMinutes(minutes);
                second_legs.forEach(function (second_leg) {
                let [hours, minutes] = second_leg.departure_time.split(':');
                let dt2 = new Date();
                dt2.setHours(+hours);
                dt2.setMinutes(minutes);
                let TravelTime = Math.round((dt2.getTime() - dt1.getTime()) / 60000);
                if (TravelTime >= 240) {
                        first_leg.sl_departure_id = second_leg.departure_id;
                        first_leg.sl_departure_iata = second_leg.departure_iata;
                        first_leg.sl_departure_time = second_leg.departure_time;
                        first_leg.sl_arrival_id = second_leg.arrival_id;
                        first_leg.sl_arrival_iata = second_leg.arrival_iata;
                        first_leg.sl_arrival_time = second_leg.arrival_time;
                        first_leg.sl_duration = second_leg.duration;
                        first_leg.travel_time = first_leg.duration + second_leg.duration;
                        first_leg.time_on_site = TravelTime;
                        oneday_trips.push(first_leg);
                }
                })
            })
            });
            drawOneDayTrip(oneday_trips);
            }
            else {if(return_option == 'long_journey') {
            destination_list.forEach(function (destination) {
            let first_legs = trips.filter(trip => trip.arrival_id == destination)
            let second_legs = findTripsFromDepartureID(destination).filter(trip => trip.arrival_id == departure_id);
            if (time_restriction != "unknown_trip" ) {second_legs = second_legs.filter(trip => trip.duration <= time_restriction)};
            first_legs.forEach(function (first_leg) {
                let [hours, minutes] = first_leg.arrival_time.split(':');
                let dt1 = new Date();
                dt1.setHours(+hours);
                dt1.setMinutes(minutes);
                second_legs.forEach(function (second_leg) {
                let [hours, minutes] = second_leg.departure_time.split(':');
                let dt2 = new Date();
                dt2.setHours(+hours);
                dt2.setMinutes(minutes);
                let TravelTime = Math.round((dt2.getTime() - dt1.getTime()) / 60000);
                if (TravelTime >= 360) {
                        first_leg.sl_departure_id = second_leg.departure_id;
                        first_leg.sl_departure_iata = second_leg.departure_iata;
                        first_leg.sl_departure_time = second_leg.departure_time;
                        first_leg.sl_arrival_id = second_leg.arrival_id;
                        first_leg.sl_arrival_iata = second_leg.arrival_iata;
                        first_leg.sl_arrival_time = second_leg.arrival_time;
                        first_leg.sl_duration = second_leg.duration;
                        first_leg.travel_time = first_leg.duration + second_leg.duration;
                        first_leg.time_on_site = TravelTime;
                        oneday_trips.push(first_leg);
                }
                })
            })
            });
            drawOneDayTrip(oneday_trips);
            }
            // For direct/indirect return on specific date
            else {
                if(last_checked_return != $('#return_date').val()){
                getReturnRecords(return_option)};
                let direct_return_base = return_base.filter(trip => trip.arrival_id == departure_id && destination_list.includes(trip.departure_id));
                if (time_restriction != "unknown_trip" ) {direct_return_base = direct_return_base.filter(trip => trip.duration <= time_restriction)};
                if (direct_only != "indirect") {
                // Check if return exist before drawing tickets
                let return_list = [];
                direct_return_base.forEach(function(trip){
                   let isIn = return_list.includes(trip.departure_id);
                        if (isIn == false) {
                            return_list.push(trip.departure_id);
                };})
                console.log(destination_list);
                console.log(return_list);
                console.log(trips);
                trips = trips.filter(trip => return_list.includes(trip.arrival_id));
                console.log(trips);
                await drawDirectTrip(trips);
                await drawDirectReturn(direct_return_base);
                } else {
               let all_indirect_returns = [];
               destination_list.forEach( await function(destination) {
               let first_leg = return_base.filter(trip => trip.departure_id == destination);
               let second_leg = return_base.filter(trip => trip.arrival_id == departure_id);
               first_leg.forEach(function (trip) {
               let [hours, minutes] = trip.arrival_time.split(':');
               let dt1 = new Date();
               dt1.setHours(+hours);
               dt1.setMinutes(minutes);
               second_leg.forEach(function(indirect_trip){
                // Check if no better direct alternative
                let dt2 = new Date();
                let [hours, minutes] = indirect_trip.departure_time.split(':');
                dt2.setHours(+hours);
                dt2.setMinutes(minutes);
                // Difftime is the connection time
                let Difftime = Math.round((dt2.getTime() - dt1.getTime()) / 60000);
                if (trip.arrival_id == indirect_trip.departure_id && Difftime > 10 && Difftime < 90) {
                       let dt3 = new Date();
                       let [hours, minutes] = indirect_trip.arrival_time.split(':');
                       dt3.setHours(+hours);
                       dt3.setMinutes(minutes);
                       let check = direct_return_base.filter(trip => trip.departure_id == destination);
                       let alternative = false;
                       for (let i in check) {
                            let dt4 = new Date();
                            let [hours, minutes] = check[i].arrival_time.split(':');
                            dt4.setHours(+hours);
                            dt4.setMinutes(minutes);
                            if ((Math.abs(dt3.getTime() - dt4.getTime()) < 3600000)) {
                            //console.log('Better alternative found - Exit loop');
                            //console.log('alternative directe existante à : ', check[i].departure_city, '-', check[i].arrival_city, ' ', check[i].departure_time, '-', check[i].arrival_time, ' au lieu de : ', trip.departure_city, '-', indirect_trip.departure_city, '-', indirect_trip.arrival_city , ' ', trip.departure_time, '-', trip.arrival_time, '-', indirect_trip.departure_time, '-', indirect_trip.arrival_time);
                            alternative = true;
                            };
                            // console.log(alternative)
                            };
                            if (alternative == false) {
                            indirect_trip.origine = trip.departure_city;
                            indirect_trip.origine_id = trip.departure_id;
                            indirect_trip.origine_iata = trip.departure_iata;
                            indirect_trip.origine_departure = trip.departure_time;
                            indirect_trip.connection_arrival = trip.arrival_time;
                            indirect_trip.connection_iata = trip.arrival_iata;
                            indirect_trip.full_duration = indirect_trip.duration + trip.duration + Difftime;
                            indirect_trip.connection_time = Difftime;
                            if (time_restriction != "unknown_trip" ) {if (indirect_trip.full_duration <= time_restriction){all_indirect_returns.push(indirect_trip);}} else {all_indirect_returns.push(indirect_trip);};
                            // console.log(indirect_trip.arrival_city, ' depuis ', indirect_trip.departure_city, ' ', trip.departure_time,'-',trip.arrival_time,'-',indirect_trip.departure_time,'-',indirect_trip.arrival_time)
                            };
                           };
                           });
                           });
                           });
                        let return_list = [];
                        direct_return_base.forEach(function(trip){
                        let isIn = return_list.includes(trip.departure_id);
                        if (isIn == false) {
                            return_list.push(trip.departure_id);
                        };})
                        all_indirect_returns.forEach(function(trip){
                        let isIn = return_list.includes(trip.origine_id);
                        if (isIn == false) {
                            return_list.push(trip.origine_id);
                        };})
                        trips = trips.filter(trip => return_list.includes(trip.arrival_id));
                        all_indirect_trips = all_indirect_trips.filter(indirect_trip => return_list.includes(indirect_trip.arrival_id));
                        await drawDirectTrip(trips);
                        await drawIndirectTrip(all_indirect_trips,temp_destination_list);
                        await drawDirectReturn(direct_return_base);
                        await drawIndirectReturn(all_indirect_returns);
                        };
            };
            }};
            };

async function drawDirectTrip(trips){
    console.log("Début Exé DrawDirect");
    var destination_list = [];
    destination_list.push(trips[0].departure_id)
    trips.forEach(function(trip){
    let isIn = destination_list.includes(trip.arrival_id);
    if (isIn == false) {
            destination_list.push(trip.arrival_id);
    };
    //set up weather acceptance to true
    let accepted_weather = true;
    let identify_ticket = trip.departure_iata.toString() + trip.arrival_iata.toString() + trip.arrival_time.replace(':', '') + trip.departure_time.replace(':', '');
    if ($("#" + identify_ticket).length === 0) {


        let hours = Math.trunc(trip.duration / (60))
        let minute = Math.trunc(Math.abs(trip.duration - hours * 60));
        let display = ("0" + hours).slice(-2) + "h" + ("0" + minute).slice(-2) + "m";
        let processed_date = trip.day.toString() + '-' + trip.departure_time.split(':')[0].toString() + ':00';
        let tl_url = createTrainlineLink(processed_date, trip.departure_iata, trip.arrival_iata);

        let category_html = '<li class="card" id="' + trip.arrival_id + '">' +
                            '<img src="images/city/bg_'+ trip.arrival_id +'.jpg" width="200" height="150" class="card-img" alt="...">' +
                            '<h5 class="card-img-overlay" role="tab" id="heading' + trip.arrival_id + '">' +
                            '<a class="collapsed d-block" data-toggle="collapse" data-parent="#tickets" href="#sub' + trip.arrival_id + '" aria-expanded="false">' +
                            '<i class="fa fa-chevron-down pull-right"></i><p class="text-dark text-center bg-white" style="opacity:0.5">' + trip.arrival_city + '</p></a></h5><div class="card" id="sub' + trip.arrival_id + '"></div></li>'
        let ticket_html = '<div id="' + identify_ticket + '" class="collapse show" role="tabpanel" aria-labelledby="heading' + trip.arrival_id + '">' +
                          '<div class="card-body" href="' + tl_url + '">' +
                          '<i class="fas fa-space-shuttle"></i>' +
                          '<strong> %td | %ta </strong>'.replace('%ta', trip.arrival_time).replace('%td', trip.departure_time) +
                          'en %d !'.replace('%d', display) + '<a type="button" target="_blank" href="' + tl_url + '" class="btn btn-link btn-sm">Book</a>' +
                          '</div></div>'
        if (isIn == false) {
            $("#tickets").append(category_html);
            let current_coords = new Array();
            current_coords.push(trip.departure_coords);
            current_coords.push(trip.arrival_coords);
            var polyline = new CustomPolyline(current_coords, {
                id: 'line' + identify_ticket,
                color: 'black',
                weight: 2,
                opacity: 0.1,
                duration: trip.duration,
                dashArray: '10, 10',
                dashOffset: '0'
            });
            tripLayer.addLayer(polyline);
            markerLayer.eachLayer(function (layer) {
            if (trip.arrival_iata == layer.options.iata) {
                layer.setOpacity(0.5);
                }
            });
            $('#' + trip.arrival_id).bind('mouseover', function () {
            tripLayer.eachLayer(function (layer) {
                if (!anchored) {
                    if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'black',
                            weight: 4,
                            opacity: 1,
                            duration: trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    }
                }
                });
            markerLayer.eachLayer(function (layer) {
            if (trip.arrival_iata == layer.options.iata) {
                layer.setOpacity(1);
                }
            });
            });
            $('#' + trip.arrival_id).bind('mouseout', function () {
            tripLayer.eachLayer(function (layer) {
                let id = identify_ticket;
                if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'black',
                            weight: 4,
                            opacity: 0.1,
                            duration: trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    }
            });
            markerLayer.eachLayer(function (layer) {
            if (trip.arrival_iata == layer.options.iata) {
                layer.setOpacity(0.5);
                }
            });
        });
        $('#sub' + trip.arrival_id).append(ticket_html);
        } else {$('#sub' + trip.arrival_id).append(ticket_html)};




        var anchored = false;

        tmp_duration_list.push(trip.duration);

        /*$('#' + identify_ticket).bind('click', function () {
            console.log('test click')
            let oneTime = true;
            tripLayer.eachLayer(function (layer) {
                if (layer.options.id == identify_ticket && oneTime) {
                    oneTime = false;
                    console.log(layer.options.id);
                    console.log(layer)
                    console.log(anchored)
                    let center_x = (trip.departure_coords[0] + Number(trip.arrival_coords[0])) / 2;
                    let center_y = (trip.departure_coords[1] + Number(trip.arrival_coords[1])) / 2;

                    if (typeof anchored == 'undefined') {
                        anchored = true;

                        $('#' + identify_ticket).css("background-color", "#9d9efd");
                        //fly to center of selected trip
                        map.flyTo([center_x, center_y], 6, {
                            'animate': true
                        });
                    } else {
                        if (anchored) {
                            anchored = false;
                            layer.setStyle({
                                color: 'black',
                                weight: 4,
                                opacity: 0.02,
                                duration: trip.duration,
                                dashArray: '10, 10',
                                dashOffset: '0'
                            });
                            $('#' + identify_ticket).css("background-color", "#57587f");
                        } else {
                            anchored = true;
                            layer.setStyle({
                                color: 'red',
                                weight: 4,
                                opacity: 1,
                                duration: trip.duration,
                                dashArray: '10, 10',
                                dashOffset: '0'
                            });
                            $('#' + identify_ticket).css("background-color", "#9d9efd");
                            tripLayer.eachLayer(function (previous_layer) {
                                if (previous_layer.options.id == previousid) {
                                    previous_layer.setStyle({
                                        color: 'black',
                                        weight: 4,
                                        opacity: 0.02,
                                        duration: trip.duration,
                                        dashArray: '10, 10',
                                        dashOffset: '0'
                                    });
                                }
                            });
                            $('#' + previousid).css("background-color", "#57587f");
                        }
                        map.flyTo([center_x, center_y], 7, {
                            'animate': true
                        });
                        //map.fitBounds(layer.getBounds());
                    }
                    previousid = identify_ticket;
                }
            });
        });

        */
    }


// //WEATHER RESTRICTION
// if (weather_restriction !== 'unknown_weather') {
//     console.log('Apply weather restriction...');
//     accepted_weather = acceptWeather(trip, weather_restriction);
// }
// //SCHEDULE RESTRICTION
// if (time_restriction !== 'unknown_time') {
//     console.log('Apply schedule restriction...');
//     let from = trip.day.split("-");
//     var arrival_formatted_date = new Date(from[0], from[1] - 1, from[2], trip.arrival_time.split(':')[0], trip.arrival_time.split(':')[1])
//     time_restriction = time_restriction.replace('h', '');
//     let shifted_date = arrival_formatted_date;
//     shifted_date.setHours(shifted_date.getHours() + Number(time_restriction));
//     let shifted_day_query = undefined;
//     if (shifted_date.getDay() < 10) {
//         shifted_day_query = shifted_date.getFullYear() + '-' + ("0" + (shifted_date.getMonth() + 1)).slice(-2) + "-" + ("0" + shifted_date.getDate()).slice(-2);
//     } else {
//         shifted_day_query = shifted_date.getFullYear() + '-' + ("0" + (shifted_date.getMonth() + 1)).slice(-2) + "-" + shifted_date.getDate();
//     }

//     var return_query = 'https://data.sncf.com/api/records/1.0/search/?dataset=tgvmax' +
//         '&q=&rows=10000&sort=date&facet=origine_iata&refine.od_happy_card=OUI' +
//         '&refine.date=%date'.replace('%date', shifted_day_query) + //format: YYYY-MM-DD
//         '&refine.origine_iata=%arrival'.replace('%arrival', trip.arrival_iata) +
//         '&refine.destination_iata=%departure'.replace('%departure', trip.departure_iata)
//     $.getJSON(return_query, function (response) {
//         let isThereRecords = false;
//         response.records.forEach(function (record) {
//             let from_return = record.fields.date.split("-");
//             var return_format_date = new Date(from_return[0], from_return[1] - 1, from_return[2], record.fields.heure_depart.split(':')[0], record.fields.heure_depart.split(':')[1]);
//             let difference_time = shifted_date.getTime() - return_format_date.getTime();
//             let isMatchingSlot = (difference_time > 0) && (difference_time < time_restriction * 60 * 60 * 1000)
//             if (isMatchingSlot) {
//                 console.log('Add return to given trip...');
//                 isThereRecords = true;
//                 let trip_back = {};
//                 trip_back.time = record.fields.date;
//                 trip_back.heure_depart = record.fields.heure_depart;
//                 trip_back.heure_arrivee = record.fields.heure_arrivee;
//                 trip_back.duration = calculateDuration(record.fields.heure_arrivee, record.fields.heure_depart);
//                 let processed_date = trip.day.toString() + '-' + trip_back.heure_depart.split(':')[0].toString() + ':00';
//                 trip.return_trips.push(trip_back);
//                 let tl_return_url = createTrainlineLink(processed_date, trip.arrival_iata, trip.departure_iata);
//                 let return_html = undefined;
//                 console.log(shifted_day_query.split('-')[2]);
//                 console.log(trip.day.split('-')[2]);
//                 if (shifted_day_query.split('-')[2] !== trip.day.split('-')[2]) {
//                     return_html = '<p class="card-text text-white p-0 my-auto"><i class="fas fa-train"></i><a href="' + tl_return_url + '" style=" text:right;color:white;" target="_blank""> %depart <i class="fas fa-angle-double-right"></i> %arrivee (+1)</a></p>'
//                         .replace('%depart', trip_back.heure_depart).replace('%arrivee', trip_back.heure_arrivee)
//                 } else {
//                     return_html = '<p class="card-text text-white p-0 my-auto"><i class="fas fa-train"></i><a href="' + tl_return_url + '" style=" text:right;color:white;" target="_blank""> %depart <i class="fas fa-angle-double-right"></i> %arrivee </a></p>'
//                         .replace('%depart', trip_back.heure_depart).replace('%arrivee', trip_back.heure_arrivee)
//                 }

//                 $("#back_" + identify_ticket).append(return_html);
//                 $('#panel').css('visibility', 'hidden');
//             }

//         })
//         if (time_restriction === '24') {
//             console.log('Check previous day...')
//             let previous_day = new Date(shifted_date.setDate(shifted_date.getDate() - 1));
//             let date_previous_day_query = undefined;
//             if (shifted_date.getDay() < 10) {
//                 date_previous_day_query = previous_day.getFullYear() + '-' + ("0" + (previous_day.getMonth() + 1)).slice(-2) + "-" + ("0" + previous_day.getDate()).slice(-2);
//             } else {
//                 date_previous_day_query = previous_day.getFullYear() + '-' + ("0" + (previous_day.getMonth() + 1)).slice(-2) + "-" + previous_day.getDate();
//             }
//             var previous_day_query = 'https://data.sncf.com/api/records/1.0/search/?dataset=tgvmax' +
//                 '&q=&rows=10000&sort=date&facet=origine_iata&refine.od_happy_card=OUI' +
//                 '&refine.date=%date'.replace('%date', date_previous_day_query) + //format: YYYY-MM-DD
//                 '&refine.origine_iata=%arrival'.replace('%arrival', trip.arrival_iata) +
//                 '&refine.destination_iata=%departure'.replace('%departure', trip.departure_iata);
//             $.getJSON(previous_day_query, function (response) {
//                 response.records.forEach(function (record) {
//                     let from_return = record.fields.date.split("-");
//                     var return_format_date = new Date(from_return[0], from_return[1] - 1, from_return[2], record.fields.heure_depart.split(':')[0], record.fields.heure_depart.split(':')[1]);
//                     let difference_time = shifted_date.getTime() - return_format_date.getTime();
//                     let isMatchingSlot = (difference_time > 0) && (difference_time < time_restriction * 60 * 60 * 1000);
//                     if (isMatchingSlot) {
//                         console.log('Add return to given trip...')
//                         isThereRecords = true;
//                         let trip_back = {};
//                         trip_back.time = record.fields.date;
//                         trip_back.heure_depart = record.fields.heure_depart;
//                         trip_back.heure_arrivee = record.fields.heure_arrivee;
//                         trip_back.duration = calculateDuration(record.fields.heure_arrivee, record.fields.heure_depart);
//                         let processed_date = trip.day + '-' + trip_back.heure_depart.split(':')[0] + ':00';
//                         trip.return_trips.push(trip_back);
//                         let tl_return_url = createTrainlineLink(processed_date, trip.arrival_iata, trip.departure_iata);
//                         let return_html = undefined;
//                         return_html = '<p class="card-text text-white p-0 my-auto"><i class="fas fa-train"></i><a href="' + tl_return_url + '" style=" text:right;color:white;" target="_blank""> %depart <i class="fas fa-angle-double-right"></i> %arrivee </a></p>'
//                             .replace('%depart', trip_back.heure_depart).replace('%arrivee', trip_back.heure_arrivee);
//                         $("#back_" + identify_ticket).append(return_html);
//                     }

//                 });
//             });

//         }
//         if (isThereRecords) {
//             $('#btn_return_' + identify_ticket).show();
//         }
//     })
// }

});
markerLayer.eachLayer(function (layer) {
            if (destination_list.includes(layer.options.id) == false) {
                layer.setOpacity(0.4);
                layer.setIcon(L.icon({"iconSize": [10,10], "iconUrl":"images/icons/circle.png"}))
                } else {
                layer.setOpacity(1);
                layer.setIcon(L.icon({"iconSize": [20,20], "iconUrl":"images/icons/placeholder.png"}))
                }
            if (layer.options.id == trips[0].departure_id) {layer.setIcon(L.icon({"iconSize": [20,20], "iconUrl":"images/icons/station.png"}))}
            });
console.log("Fin Exé DrawDirect");};

async function drawIndirectTrip(indirect_trips,destination_list){
    console.log('Debut Exé DrawIndirect');
    //set up weather acceptance to true
    let accepted_weather = true;
    indirect_trips.forEach(function(indirect_trip){
        let origin_ticket = 'line' + indirect_trip.origine_iata.toString() + indirect_trip.connection_iata.toString() + indirect_trip.connection_arrival.replace(':', '') + indirect_trip.origine_departure.replace(':', '');
        let isIn = destination_list.includes(indirect_trip.arrival_id);
        if (isIn == false) {
                destination_list.push(indirect_trip.arrival_id);
                // console.log(destination_list)
        };
        let identify_ticket = indirect_trip.origine_iata.toString() + indirect_trip.connection_iata.toString() + indirect_trip.departure_iata.toString() + indirect_trip.arrival_iata.toString() + indirect_trip.arrival_time.replace(':', '') + indirect_trip.origine_departure.replace(':', '');

    if ($("#" + identify_ticket).length === 0) {

        let current_coords = new Array();
        current_coords.push(indirect_trip.departure_coords);
        current_coords.push(indirect_trip.arrival_coords);
        var polyline = new CustomPolyline(current_coords, {
            id: 'line' + identify_ticket,
            color: 'blue',
            weight: 2,
            opacity: 0.02,
            duration: indirect_trip.duration,
            dashArray: '10, 10',
            dashOffset: '0'
        });
        tripLayer.addLayer(polyline);
        //var polygon = getTripPolygon(trip.departure_coords,trip.arrival_coords);

        let hours = Math.trunc(indirect_trip.full_duration / (60))
        let minute = Math.trunc(Math.abs(indirect_trip.full_duration - hours * 60));
        let display = ("0" + hours).slice(-2) + "h" + ("0" + minute).slice(-2) + "m";
        let processed_date = indirect_trip.day.toString() + '-' + indirect_trip.origine_departure.split(':')[0].toString() + ':00';
        let tl_url = createTrainlineLink(processed_date, indirect_trip.origine_iata, indirect_trip.arrival_iata);

        let category_html = '<li class="card" id="' + indirect_trip.arrival_id + '">' +
                            '<img src="images/city/bg_'+ indirect_trip.arrival_id +'.jpg" width="200" height="150" class="card-img" alt="...">' +
                            '<h5 class="card-img-overlay" role="tab" id="heading' + indirect_trip.arrival_id + '">' +
                            '<a class="collapsed d-block" data-toggle="collapse" data-parent="#tickets" href="#sub' + indirect_trip.arrival_id + '" aria-expanded="false">' +
                            '<i class="fa fa-chevron-down pull-right"></i><p class="text-dark text-center bg-white" style="opacity:0.5">' + indirect_trip.arrival_city + '</p></a></h5><div class="card" id="sub' + indirect_trip.arrival_id + '"></div></li>'

        let ticket_html = '<div id="' + identify_ticket + '" class="collapse show" role="tabpanel" aria-labelledby="heading' + indirect_trip.arrival_id + '">' +
                          '<div class="card-body" href="' + tl_url + '">' +
                          '<i class="fas fa-paper-plane"></i>' +
                          '<strong> %td </strong>| %tac <i class="fas fa-history"></i><br> %tdc | <strong>%ta </strong><br> ... via la belle ville de %sc pendant <strong>%tc min</strong> <br>'.replace('%td', indirect_trip.origine_departure).replace('%tac', indirect_trip.connection_arrival).replace('%sc', indirect_trip.departure_city).replace('%tc', indirect_trip.connection_time).replace('%tdc', indirect_trip.departure_time).replace('%ta', indirect_trip.arrival_time)+
                          'le tout en <strong> %d </strong>!'.replace('%d', display) + '<a type="button" target="_blank" href="' + tl_url + '" class="btn btn-link btn-sm">Book</a>'
                          '</div></div>'

        if (isIn == false) {
            $("#tickets").append(category_html);

            $('#sub' + indirect_trip.arrival_id).append(ticket_html);
        } else {$('#sub' + indirect_trip.arrival_id).append(ticket_html)};

        $('#' + identify_ticket).bind('mouseover', function () {
            tripLayer.eachLayer(function (layer) {
                if (!anchored) {
                    if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'blue',
                            weight: 4,
                            opacity: 1,
                            duration: indirect_trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    };
                    if (layer.options.id == origin_ticket ) {
                        layer.setStyle({
                                id: origin_ticket,
                                color: 'yellow',
                                weight: 4,
                                opacity: 1,
                                duration: indirect_trip.duration,
                                dashArray: '10, 10',
                                dashOffset: '0'
                            });
                    };
                }
                });
            markerLayer.eachLayer(function (layer) {
            if (indirect_trip.arrival_iata == layer.options.iata) {
                layer.setOpacity(1);
                     };
            if (indirect_trip.connection_iata == layer.options.iata) {
                        layer.setOpacity(0.9);
                        }
                });
            });
            $('#' + identify_ticket).bind('mouseout', function () {
            tripLayer.eachLayer(function (layer) {
                let id = identify_ticket;
                if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'blue',
                            weight: 2,
                            opacity: 0.2,
                            duration: indirect_trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    };

                   if (layer.options.id == origin_ticket ) {
                        layer.setStyle({
                                id: origin_ticket,
                                color: 'black',
                                weight: 4,
                                opacity: 0.1,
                                duration: indirect_trip.duration,
                                dashArray: '10, 10',
                                dashOffset: '0'
                            });
                    };

                });
                markerLayer.eachLayer(function (layer) {
                    if (indirect_trip.arrival_iata == layer.options.iata) {
                        layer.setOpacity(0.5);
                        }
                    if (indirect_trip.connection_iata == layer.options.iata) {
                        layer.setOpacity(0.5);
                        }
                    });
            });

        tmp_duration_list.push(indirect_trip.duration);

        var anchored = false;

        markerLayer.eachLayer(function (layer) {
            if (indirect_trip.arrival_iata == layer.options.iata) {
                layer.setOpacity(0.5);
            }
        });

    }
    });
markerLayer.eachLayer(function (layer) {
            if (destination_list.includes(layer.options.id) == false) {
                layer.setOpacity(0.4);
                layer.setIcon(L.icon({"iconSize": [10,10], "iconUrl":"images/icons/circle.png"}))
                } else {
                layer.setOpacity(1);
                layer.setIcon(L.icon({"iconSize": [20,20], "iconUrl":"images/icons/placeholder.png"}))
                }
            if (layer.options.id == trips[0].departure_id) {layer.setIcon(L.icon({"iconSize": [20,20], "iconUrl":"images/icons/station.png"}))}
            });
console.log('Fin Exé DrawIndirect');

}

async function drawDirectReturn(trips){
    console.log("Début Exé DrawDirect Return");
    trips.forEach(function(trip){
    let identify_ticket = trip.departure_iata.toString() + trip.arrival_iata.toString() + trip.arrival_time.replace(':', '') + trip.departure_time.replace(':', '');
    if ($("#" + identify_ticket).length === 0) {

        let hours = Math.trunc(trip.duration / (60))
        let minute = Math.trunc(Math.abs(trip.duration - hours * 60));
        let display = ("0" + hours).slice(-2) + "h" + ("0" + minute).slice(-2) + "m";
        let processed_date = trip.day.toString() + '-' + trip.departure_time.split(':')[0].toString() + ':00';
        let tl_url = createTrainlineLink(processed_date, trip.departure_iata, trip.arrival_iata);

        let ticket_html = '<div id="' + identify_ticket + '" class="collapse show" role="tabpanel" aria-labelledby="heading' + trip.departure_id + '">' +
                          '<div class="card-body" href="' + tl_url + '">' +
                          '<i class="fa fa-angle-double-left"></i>' +
                          '<strong> %td | %ta </strong>'.replace('%ta', trip.arrival_time).replace('%td', trip.departure_time) +
                          'en %d !'.replace('%d', display) + '<a type="button" target="_blank" href="' + tl_url + '" class="btn btn-link btn-sm">Book</a>' +
                          '</div></div>'
        $('#sub' + trip.departure_id).append(ticket_html);

        var anchored = false;

        tmp_duration_list.push(trip.duration);
    }
});

console.log("Fin Exé DrawDirect Return");};

async function drawIndirectReturn(indirect_trips){
    console.log('Debut Exé DrawIndirect Returns');
    var anchored = false;
    indirect_trips.forEach(function(indirect_trip){
        let origin_ticket = 'line' + indirect_trip.origine_iata.toString() + indirect_trip.connection_iata.toString() + indirect_trip.connection_arrival.replace(':', '') + indirect_trip.origine_departure.replace(':', '');

        let identify_ticket = indirect_trip.origine_iata.toString() + indirect_trip.connection_iata.toString() + indirect_trip.departure_iata.toString() + indirect_trip.arrival_iata.toString() + indirect_trip.arrival_time.replace(':', '') + indirect_trip.origine_departure.replace(':', '');

    if ($("#" + identify_ticket).length === 0) {

        let current_coords = new Array();
        current_coords.push(indirect_trip.departure_coords);
        current_coords.push(indirect_trip.arrival_coords);
        var polyline = new CustomPolyline(current_coords, {
            id: 'line' + identify_ticket,
            color: 'blue',
            weight: 2,
            opacity: 0.02,
            duration: indirect_trip.duration,
            dashArray: '10, 10',
            dashOffset: '0'
        });
        tripLayer.addLayer(polyline);

        let hours = Math.trunc(indirect_trip.full_duration / (60))
        let minute = Math.trunc(Math.abs(indirect_trip.full_duration - hours * 60));
        let display = ("0" + hours).slice(-2) + "h" + ("0" + minute).slice(-2) + "m";
        let processed_date = indirect_trip.day.toString() + '-' + indirect_trip.origine_departure.split(':')[0].toString() + ':00';
        let tl_url = createTrainlineLink(processed_date, indirect_trip.origine_iata, indirect_trip.arrival_iata);

        let ticket_html = '<div id="' + identify_ticket + '" class="collapse show" role="tabpanel" aria-labelledby="heading' + indirect_trip.arrival_id + '">' +
                          '<div class="card-body" href="' + tl_url + '">' +
                          '<i class="fa fa-angle-left"></i>' +
                          '<strong> %td </strong>| %tac <i class="fas fa-history"></i><br> %tdc | <strong>%ta </strong><br> ... via la belle ville de %sc pendant <strong>%tc min</strong> <br>'.replace('%td', indirect_trip.origine_departure).replace('%tac', indirect_trip.connection_arrival).replace('%sc', indirect_trip.departure_city).replace('%tc', indirect_trip.connection_time).replace('%tdc', indirect_trip.departure_time).replace('%ta', indirect_trip.arrival_time)+
                          'le tout en <strong> %d </strong>!'.replace('%d', display) + '<a type="button" target="_blank" href="' + tl_url + '" class="btn btn-link btn-sm">Book</a>'
                          '</div></div>'


        $('#sub' + indirect_trip.origine_id).append(ticket_html);

        $('#' + identify_ticket).bind('mouseover', function () {
            tripLayer.eachLayer(function (layer) {
                if (!anchored) {
                    if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'blue',
                            weight: 4,
                            opacity: 1,
                            duration: indirect_trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    };
                    if (layer.options.id == origin_ticket ) {
                        layer.setStyle({
                                id: origin_ticket,
                                color: 'yellow',
                                weight: 4,
                                opacity: 1,
                                duration: indirect_trip.duration,
                                dashArray: '10, 10',
                                dashOffset: '0'
                            });
                    };
                }
                });
            markerLayer.eachLayer(function (layer) {
            if (indirect_trip.connection_iata == layer.options.iata) {
                        layer.setOpacity(0.9);
                        }
                });
            });
            $('#' + identify_ticket).bind('mouseout', function () {
            tripLayer.eachLayer(function (layer) {
                let id = identify_ticket;
                if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'blue',
                            weight: 2,
                            opacity: 0.2,
                            duration: indirect_trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    };

                   if (layer.options.id == origin_ticket ) {
                        layer.setStyle({
                                id: origin_ticket,
                                color: 'black',
                                weight: 4,
                                opacity: 0.1,
                                duration: indirect_trip.duration,
                                dashArray: '10, 10',
                                dashOffset: '0'
                            });
                    };

                });

                markerLayer.eachLayer(function (layer) {
                    if (indirect_trip.connection_iata == layer.options.iata) {
                        layer.setOpacity(0.5);
                        }
                    });
            });
    }
    });

console.log('Fin Exé DrawIndirect Returns');

}

async function drawOneDayTrip(trips) {
    console.log("Début Exé Draw one-day trips");
    var destination_list = [];
    trips.forEach(function(trip){
    let isIn = destination_list.includes(trip.arrival_id);
    if (isIn == false) {
            destination_list.push(trip.arrival_id);
    };
    //set up weather acceptance to true
    let accepted_weather = true;
    let identify_ticket = trip.departure_iata.toString() + trip.arrival_iata.toString() + trip.arrival_time.replace(':', '') + trip.departure_time.replace(':', '');
    if ($("#" + identify_ticket).length === 0) {

        let current_coords = new Array();
        current_coords.push(trip.departure_coords);
        current_coords.push(trip.arrival_coords);
        var polyline = new CustomPolyline(current_coords, {
            id: 'line' + identify_ticket,
            color: 'red',
            weight: 4,
            opacity: 0.1,
            duration: trip.duration,
            dashArray: '10, 10',
            dashOffset: '0'
        });
        tripLayer.addLayer(polyline);

        //Display time first way
        let hours = Math.trunc(trip.duration/ (60))
        //console.log(hours)
        let minute = Math.trunc(Math.abs(trip.duration - hours * 60));
        //console.log(minute)
        let display = ("0" + hours).slice(-2) + "h" + ("0" + minute).slice(-2) + "m";
        let processed_date = trip.day.toString() + '-' + trip.departure_time.split(':')[0].toString() + ':00';
        let tl_url = createTrainlineLink(processed_date, trip.departure_iata, trip.arrival_iata);

        // Display time second way
        let sl_hours = Math.trunc(trip.sl_duration / (60))
        let sl_minute = Math.trunc(Math.abs(trip.sl_duration - sl_hours * 60));
        let sl_display = ("0" + sl_hours).slice(-2) + "h" + ("0" + sl_minute).slice(-2) + "m";
        let sl_processed_date = trip.day.toString() + '-' + trip.sl_departure_time.split(':')[0].toString() + ':00';
        let sl_tl_url = createTrainlineLink(sl_processed_date, trip.sl_departure_iata, trip.sl_arrival_iata);

        // Display time on site & in the train
        let tos_hours = Math.trunc(trip.time_on_site / (60))
        let tos_minute = Math.trunc(Math.abs(trip.time_on_site - tos_hours * 60));
        let tos_display = ("0" + tos_hours).slice(-2) + "h" + ("0" + tos_minute).slice(-2) + "m";
        let it_hours = Math.trunc(trip.travel_time / (60))
        let it_minute = Math.trunc(Math.abs(trip.travel_time - it_hours * 60));
        let it_display = ("0" + it_hours).slice(-2) + "h" + ("0" + it_minute).slice(-2) + "m";

        let category_html = '<li class="card" id="' + trip.arrival_id + '">' +
                            '<img src="images/city/bg_'+ trip.arrival_id +'.jpg" width="200" height="150" class="card-img" alt="...">' +
                            '<h5 class="card-img-overlay" role="tab" id="heading' + trip.arrival_id + '">' +
                            '<a class="collapsed d-block" data-toggle="collapse" data-parent="#tickets" href="#sub' + trip.arrival_id + '" aria-expanded="false">' +
                            '<i class="fa fa-chevron-down pull-right"></i><p class="text-dark text-center bg-white" style="opacity:0.5">' + trip.arrival_city + '</p></a></h5><div class="card" id="sub' + trip.arrival_id + '"></div></li>'
        let ticket_html = '<div id="' + identify_ticket + '" class="collapse show" role="tabpanel" aria-labelledby="heading' + trip.arrival_id + '">' +
                          '<div class="card-body" href="' + tl_url + '">' +
                          '<i class="fa fa-arrow-circle-right"></i>' +
                          '<strong> %td | %ta </strong>'.replace('%ta', trip.arrival_time).replace('%td', trip.departure_time) +
                          'en %d !'.replace('%d', display) + '<a type="button" target="_blank" href="' + tl_url + '" class="btn btn-link btn-sm">Book</a>' + '<br>' +
                          '<i class="fa fa-arrow-circle-left"></i>' +
                          '<strong> %td | %ta </strong>'.replace('%ta', trip.sl_arrival_time).replace('%td', trip.sl_departure_time) +
                          'en %d !'.replace('%d', sl_display) + '<a type="button" target="_blank" href="' + sl_tl_url + '" class="btn btn-link btn-sm">Book</a>' + '<br>' +
                          'Time on site : %tos'.replace('%tos',tos_display) + " | " + 'Time in the train : %it'.replace('%it',it_display) +
                          '</div></div>'
        if (isIn == false) {
            $("#tickets").append(category_html);
            $('#' + trip.arrival_id).bind('mouseover', function () {
            tripLayer.eachLayer(function (layer) {
                if (!anchored) {
                    if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'black',
                            weight: 4,
                            opacity: 1,
                            duration: trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    }
                }
                });
            });
            $('#' + trip.arrival_id).bind('mouseout', function () {
            tripLayer.eachLayer(function (layer) {
                let id = identify_ticket;
                if (layer.options.id == 'line' + identify_ticket) {
                        layer.setStyle({
                            id: 'line' + identify_ticket,
                            color: 'black',
                            weight: 4,
                            opacity: 0.1,
                            duration: trip.duration,
                            dashArray: '10, 10',
                            dashOffset: '0'
                        });
                    }
            });
        });
        $('#sub' + trip.arrival_id).append(ticket_html);
        } else {$('#sub' + trip.arrival_id).append(ticket_html)};




        var anchored = false;
        tmp_duration_list.push(trip.duration);


        markerLayer.eachLayer(function (layer) {
            if (trip.arrival_iata == layer.options.iata) {
                layer.setOpacity(1);
            }
        });
    }

});

console.log("Fin Exé Draw one-day trips");

}
function createTrainlineLink(departure_time,departure_iata,arrival_iata){
        //build trainline link
        let link = "https://www.trainline.fr/search/%depiata/%arriata/%date"
            .replace('%depiata',departure_iata)
            .replace('%arriata',arrival_iata)
            .replace('%date',(departure_time));

        return link;
    }