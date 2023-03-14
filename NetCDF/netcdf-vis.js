// Load Leaflet map

function initDemoMap(){

    // Old baselayers
    /*
    var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, ' +
        'NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    });
    var OpenStreetMap_Mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    	maxZoom: 19,
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    var Esri_DarkGreyCanvas = L.tileLayer(
        "https://{s}.sm.mapstack.stamen.com/" +
        "(toner-lite,$fff[difference],$fff[@23],$fff[hsl-saturation@20])/" +
        "{z}/{x}/{y}.png",
        {
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, ' +
            'NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
        }
    );

    */

    // New baselayers
    var Esri_DarkGreyCanvas = L.esri.basemapLayer('DarkGray')
    var Esri_WorldImagery = L.esri.basemapLayer('Imagery')
    var test = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    var baseLayers = {
        "Grey Canvas": Esri_DarkGreyCanvas,
        "Satellite": Esri_WorldImagery,
        "test" : test
    };


    // set map bounds
    var corner1 = L.latLng(33, 124),
    corner2 = L.latLng(60, 132),
    bounds = L.latLngBounds(corner1, corner2);

    var map = L.map('map', {
        layers: [ test ],
        center: bounds.getCenter(),
        zoom: 15,
        minZoom: 2,
        maxZoom: 15,
        maxBounds: bounds,
        maxBoundsViscosity: 1
    });

    // layer control panal
    var layerControl = L.control.layers(baseLayers,null,{collapsed:false});
    layerControl.addTo(map);
    map.setView([0, 0], 7);

    // idw-map
    //idw 데이터 포인트 사이의 거리를 기준으로 값을 보간하는 방법
    var idw = L.idwLayer(addressPoints,{
            opacity: 0.3,
            maxZoom: 18,
            cellSize: 5, //역 거리 가중치 보간을 계산하는데 사용되는 "그리드 셀의 픽셀 크기"를 지정하는 옵션. 값이 클수록 보간이 거칠어지고 작을수록 미세해짐
            exp: 3,
            max: 75
        })
    idw.addTo(map);
    layerControl.addOverlay(idw, 'Global Temp').addTo(map);
    //L.control.layers(overlays,null,{collapsed:false}).addTo(map);

    return {
        map: map,
        layerControl: layerControl
    };

}

// leaflet-velocity layer
var mapStuff = initDemoMap();
var map = mapStuff.map;
var layerControl = mapStuff.layerControl;

// load data (u, v grids) from somewhere (e.g. https://github.com/danwild/wind-js-server)
$.getJSON('data/wind.json', function (data) {

	var velocityLayer = L.velocityLayer({
		displayValues: true,
		displayOptions: {
			velocityType: 'Wind',
			displayPosition: 'bottomleft',
			displayEmptyString: 'No wind data'
		},
		data: data,
		maxVelocity: 25
	});

	layerControl.addOverlay(velocityLayer, 'Global Wind');
});
