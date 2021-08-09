let map;
let marker;
let lines;
let markers = [];
let callMarkers = [];
const busStops = {};
const apiKey = "YOUR_API_KEY_HERE"


function initMap(){
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 37.335480, lng: -121.8863},
        zoom: 8
    });
    createTable()
};


const fetchStops = async () => {
    const res = await fetch(`http://api.511.org/transit/stops?api_key=${apiKey}&operator_id=SC`);
    const json = await res.json();
    const stops = json.Contents.dataObjects.ScheduledStopPoint;
    stops.forEach(stop => {
        busStops[stop.id] = {lat: stop.Location.Latitude, lng: stop.Location.Longitude, name: stop.Name}
    })
};

const fetchLocations = async() => {
    const res = await fetch(`http://api.511.org/transit/VehicleMonitoring?api_key=${apiKey}&agency=SC`);
    const json = await res.json();
    const activity = json.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity;

    return activity.filter(d => (d.MonitoredVehicleJourney.LineRef !== null && d.MonitoredVehicleJourney.OnwardCalls && d.MonitoredVehicleJourney.OnwardCalls.OnwardCall.length)).map(d => {
        const vehicleJourney = d.MonitoredVehicleJourney;
        return {
            name: vehicleJourney.PublishedLineName,
            destination: vehicleJourney.DestinationName, 
            line: vehicleJourney.LineRef, 
            long: vehicleJourney.VehicleLocation.Longitude, 
            lat: vehicleJourney.VehicleLocation.Latitude,
            vehicleRef: vehicleJourney.VehicleRef,
            averageSpeed: calcAverageSpeed(vehicleJourney.OnwardCalls),
            nextStop: busStops[vehicleJourney.OnwardCalls.OnwardCall[0].StopPointRef].name,
            onwardCalls: vehicleJourney.OnwardCalls
            }
        })
}

const doneLoading = () => {
    const loader = document.getElementById('loader')
    const body = document.querySelector('body');
    body.style.backgroundColor = 'white'
    loader.style.display = 'none'
}

const createTable = () => {
    fetchStops().then(async() =>{ 
        doneLoading();
        const locationData = await fetchLocations();
        const table = new Tabulator('#table', {
            reactiveData: true,
            data: locationData, 
            autoColumns: true, 
            layout:"fitDataStretch",
            cellClick: (e, cell) => handleClick(e, cell)
        })
        table.hideColumn('onwardCalls');
    })
}

const handleClick = (e, cell) => {
    const image ={ url: `../assets/bus.png`, scaledSize: new google.maps.Size(40, 25)};
    const rowData = cell._cell.row.data;

    if(markers.length) markers.forEach(m => m.setMap(null));

    const loc = {lat: rowData.lat, lng: rowData.long}
    const markerPos = new google.maps.LatLng(loc.lat, loc.lng);

    marker = new google.maps.Marker({
        position: markerPos,
        title: 'hello world', 
        icon: image
    });

    createRoute(rowData.onwardCalls, markerPos);
    marker.setMap(map)
    markers.push(marker);
    map.setCenter(markerPos);
    map.setZoom(14)
}

const createRoute = (calls, busPos) => {
    if(callMarkers.length) callMarkers.forEach(c => c.setMap(null));
    const coord = [busPos];

    calls = calls.OnwardCall.slice(0, 5)
    calls.forEach(call => {
        const markerPos = new google.maps.LatLng(busStops[call.StopPointRef].lat, busStops[call.StopPointRef].lng);
        const callMark = new google.maps.Marker({
            position: markerPos,
            map
        });
        callMarkers.push(callMark);
        const infowindow = new google.maps.InfoWindow({
            content: busStops[call.StopPointRef].name,
        });
        callMark.addListener("click", () => { infowindow.open(callMark.get("map"), callMark) })
        coord.push(markerPos);
    })
}

const calcAverageSpeed = (onwardCalls) => {
    const calls = onwardCalls.OnwardCall;
    let dist = 0;
    let time = 0;

    for(let i = 0; i < calls.length - 1; i++) {
        const dep = new Date(calls[i].AimedDepartureTime);
        const arr = new Date(calls[i + 1].AimedArrivalTime);
        const currStopPos = new google.maps.LatLng(busStops[calls[i].StopPointRef].lat, busStops[calls[i].StopPointRef].lng)
        const nextStopPos = new google.maps.LatLng(busStops[calls[i + 1].StopPointRef].lat, busStops[calls[i + 1].StopPointRef].lng)

        dist += Number((google.maps.geometry.spherical.computeDistanceBetween(currStopPos, nextStopPos) / 1000).toFixed(2))
        time += ((arr - dep) / 3600000)
    };

    const avgSpeed = Math.floor(dist / time);

   return Number.isNaN(avgSpeed) ?  '0mph' : `${avgSpeed}mph`
}



( function updateData() {
    window.setInterval(() => {
        console.log('fetching locations....')
        fetchLocations()
    }, 60000)
})()