/*
 (c) 2016, Manuel Bär (www.geonet.ch)
 Leaflet.idw, a tiny and fast inverse distance weighting plugin for Leaflet.
 Largely based on the source code of Leaflet.heat by Vladimir Agafonkin (c) 2014
 https://github.com/Leaflet/Leaflet.heat
 version: 0.0.2
*/
!function(){
"use strict";
    //지리적 데이터 -> 픽셀 데이터로 변환 -> IDW 알고리즘을 사용하여 값을 보간하고 CANVAS API를 이용해 보간된 값의 이미지 표현을 생성함
    //보간값의 범위로 색상 그라데이션을 만들고 데이터 루프를 돌면서 그 데이터가 해당하는 색상 정지점을 칠해주는 방식
    function simpleidw(canvas) {
        if (!(this instanceof simpleidw)) return new simpleidw(canvas);

        this._canvas = canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;

        //canvas 요소에 접근해서 무언가 표시할 수 있음(그리기 함수 등)
        this._ctx = canvas.getContext('2d');
        this._width = canvas.width;
        this._height = canvas.height;

        this._max = 1;
        this._data = [];
    }

    simpleidw.prototype = {

        defaultCellSize: 25,

        defaultGradient: {
            0.0: 'blue',
            0.2: 'cyan',
            0.4: 'yellow',
            0.5: 'orange',
            0.7: 'red',
            0.9: 'Maroon'
        },

        data: function (data) { //data[픽셀 x, y좌표, 보간값]
            this._data = data;
            return this;
        },

        max: function (max) {
            this._max = max;
            return this;
        },

        add: function (point) {
            this._data.push(point);
            return this;
        },

        clear: function () {
            this._data = [];
            return this;
        },

        cellSize: function (r) {
            // create a grayscale blurred cell image that we'll use for drawing points
            var cell = this._cell = document.createElement("canvas"),
                ctx = cell.getContext('2d');
                this._r = r;

            cell.width = cell.height = r;

            ctx.beginPath();
            ctx.rect(0, 0, r, r);
            ctx.fill();
            ctx.closePath();

            return this;
        },

        resize: function () {
            this._width = this._canvas.width;
            this._height = this._canvas.height;
        },

        gradient: function (grad) {
            // create a 256x1 gradient that we'll use to turn a grayscale heatmap into a colored one
            var canvas = document.createElement("canvas"),
                ctx = canvas.getContext('2d'),
                gradient = ctx.createLinearGradient(0, 0, 0, 256);

            canvas.width = 1;
            canvas.height = 256;

            for (var i in grad) {
                gradient.addColorStop(+i, grad[i]);
            }

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1, 256);

            this._grad = ctx.getImageData(0, 0, 1, 256).data;

            return this;
        },

        draw: function (opacity) {
            if (!this._cell) this.cellSize(this.defaultCellSize);
            if (!this._grad) this.gradient(this.defaultGradient);

            var ctx = this._ctx;

            ctx.clearRect(0, 0, this._width, this._height);

            // draw a grayscale idwmap by putting a cell at each data point
            for (var i = 0, len = this._data.length, p; i < len; i++) {
                p = this._data[i];
                //console.log(p);
                ctx.globalAlpha = p[2] / this._max; //불투명도
                //this._r : cellSize
                ctx.drawImage(this._cell, p[0] - this._r, p[1] - this._r); //캔버스에 그릴 이미지 요소, 왼쪽 상단 모서리 x좌표, y좌표
            }

            // colorize the heatmap, using opacity value of each pixel to get the right color from our gradient
            var colored = ctx.getImageData(0, 0, this._width, this._height);
            //각 픽셀마다 색을 담게되고
            this._colorize(colored.data, this._grad, opacity);
            //캔버스에 그림
            ctx.putImageData(colored, 0, 0); //param : 캔버스에 그릴 imageData 개체, 왼쪽 상단 모서리 x좌표, y좌표

            return this;
        },

        _colorize: function (pixels, gradient, opacity) {
            //pixel에는 빨,녹,파,투명도로 들어감
            for (var i = 0, len = pixels.length, j; i < len; i += 4) {
                j = pixels[i + 3] * 4;

                    pixels[i] = gradient[j];
                    pixels[i + 1] = gradient[j + 1];
                    pixels[i + 2] = gradient[j + 2];
                    pixels[i + 3] = opacity*256;
            }
        }
    },
    window.simpleidw = simpleidw
}(),

L.IdwLayer = (L.Layer ? L.Layer : L.Class).extend({
    /*
    options: {
        opacity: 0.5,
        maxZoom: 18,
        cellSize: 1,
        exp: 2,
        max: 100
    },
    */
    initialize: function (latlngs, options) {
        this._latlngs = latlngs;
        L.setOptions(this, options);
    },

    setLatLngs: function (latlngs) {
        this._latlngs = latlngs;
        return this.redraw();
    },

    addLatLng: function (latlng) {
        this._latlngs.push(latlng);
        return this.redraw();
    },

    setOptions: function (options) {
        L.setOptions(this, options);
        if (this._idw) {
            this._updateOptions();
        }
        return this.redraw();
    },

    redraw: function () {
        if (this._idw && !this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }

        map._panes.overlayPane.appendChild(this._canvas);

        map.on('moveend', this._reset, this);

        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._reset();
    },

    onRemove: function (map) {
        map.getPanes().overlayPane.removeChild(this._canvas);

        map.off('moveend', this._reset, this);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initCanvas: function () {
        var canvas = this._canvas = L.DomUtil.create('canvas', 'leaflet-idwmap-layer leaflet-layer');

        var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
        canvas.style[originProp] = '50% 50%';

        var size = this._map.getSize();
        canvas.width  = size.x;
        canvas.height = size.y;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));

        this._idw = simpleidw(canvas);
        this._updateOptions();
    },

    _updateOptions: function () {
        this._idw.cellSize(this.options.cellSize || this._idw.defaultCellSize);

        if (this.options.gradient) {
            this._idw.gradient(this.options.gradient);
        }
        if (this.options.max) {
            this._idw.max(this.options.max);
        }
    },

    _reset: function () {
        var topLeft = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, topLeft);

        var size = this._map.getSize();

        if (this._idw._width !== size.x) {
            this._canvas.width = this._idw._width  = size.x;
        }
        if (this._idw._height !== size.y) {
            this._canvas.height = this._idw._height = size.y;
        }

        this._redraw();
    },

    _redraw: function () {
        if (!this._map) {
            return;
        }
        var data = [],
            r = this._idw._r,
            //지도 컨테이너의 크기
            size = this._map.getSize(),
            //보간될 지도 영역의 경계 박스
            bounds = new L.Bounds(
                L.point([-r, -r]),
                size.add([r, r])),
            exp = this.options.exp === undefined ? 1 : this.options.exp,
            max = this.options.max === undefined ? 1 : this.options.max,
            maxZoom = this.options.maxZoom === undefined ? this._map.getMaxZoom() : this.options.maxZoom,
            v = 1,
            cellCen = r / 2,
            grid = [],
            nCellX = Math.ceil((bounds.max.x-bounds.min.x)/r)+1,
            nCellY = Math.ceil((bounds.max.y-bounds.min.y)/r)+1,
            panePos = this._map._getMapPanePos(),

            offsetX = 0,
            offsetY = 0,
            i, len, p, cell, x, y, j, len2, k;

            console.log(nCellX);
            console.log(nCellY);

            console.time('process');
        //입력된 지리 좌표를 inverse distance weighting 알고리즘을 사용하여 픽셀 좌표로 보간하는 과정
        for (i = 0, len = nCellY; i < len; i++) {
            for (j = 0, len2 = nCellX; j < len2; j++) {

                var x=i*r,y=j*r;
                var numerator=0,denominator=0;

                for (k = 0, len3 = this._latlngs.length; k < len3; k++) {

                    var p = this._map.latLngToContainerPoint(this._latlngs[k]);
                    var cp = L.point((y-cellCen), (x-cellCen));
                    var dist = cp.distanceTo(p);

                    var val =
                            this._latlngs[k].alt !== undefined ? this._latlngs[k].alt :
                            this._latlngs[k][2] !== undefined ? +this._latlngs[k][2] : 1;

                    if(dist===0){
                            numerator = val;
                            denominator = 1;
                            break;
                    }

                    var dist2 = Math.pow(dist, exp);

                    numerator += (val/dist2);
                    denominator += (1/dist2);

                }

                interpolVal = numerator/denominator;
                
                //픽셀의 x, y좌표, 보간값
                cell = [j*r, i*r, interpolVal];

                if (cell) {
                    data.push([
                        Math.round(cell[0]),
                        Math.round(cell[1]),
                        Math.min(cell[2], max)
                    ]);
                }
            }
        }
        console.timeEnd('process');
        console.time('draw ' + data.length);
        this._idw.data(data).draw(this.options.opacity);
        console.timeEnd('draw ' + data.length);

        this._frame = null;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());

        if (L.DomUtil.setTransform) {
            L.DomUtil.setTransform(this._canvas, offset, scale);

        } else {
            this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
        }
    }
});

L.idwLayer = function (latlngs, options) {
    return new L.IdwLayer(latlngs, options);
};
