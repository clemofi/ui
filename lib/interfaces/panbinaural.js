'use strict';

let svg = require('../util/svg');
// let math = require('../util/math');
let Interface = require('../core/interface');
// let Step = require('../models/step');
// import * as Interaction from '../util/interaction';

/**
* PanBinaural
*
* @description Interface for placing a sound around a virtual head and sending the data to a binaural synthesis engine. An unlimited number of sources can be generated. The Interface calculates the distance and the angle for each source relative to the head and returns it as a numeric value.
*
* @demo <span nexus-ui="panbinaural"></span>
*
* @example
* var panbinaural = new Nexus.PanBinaural('#target')
*
* @example
* var panbinaural = new Nexus.PanBinaural('#target',{
*   'size': [200,200]
* })
*
* @output
* change
* Fires any time the "source" node's position changes. <br>
* The event data output varies, depending on the transmit-mode setting. With the default transmit-mode setting (the value of 1), the values will only be output for the point that is being interacted with. For transmit-mode 0, it will output the values of all points.
* The data is an object containing either two arrays (transmit-mode == 0) holding distance and angle for each point, or two values (transmit-mode == 1) with distance and angle of the current point. With transmit-mode 1 it also contains the index of the current point.
*
* @outputexample
* panbinaural.on('change',function(v) {
*   console.log(v);
* })
*
*/


class Point {
  constructor(x, y, label, colorIndex) {
    this.x = x;
    this.y = y;
    this.label = label;
    this.colorIndex = colorIndex;
  }
}

export default class PanBinaural extends Interface {

  constructor() {

    let options = ['range'];

    let defaults = {
      'size': [700,700],
      'mode': 'absolute'
    };

    super(arguments,options,defaults);

    // for choosing the right point to move
    this.activePoint = undefined;

    // determines which color is applied to newly generated points
    this.currentColorIndex = 0;

    // width in pixels for scale (how many pixels are 1 meter)
    this.meterScale = 100;

    // val is an array containing all the points on the canvas.
    this.val = [];

    this.circleCenterX = this.width/2;
    this.circleCenterY = this.height/2;

    this.listenerPoint = new Point(this.circleCenterX, this.circleCenterY, 'Listener', 0);

    // radius for background circle
    this.bgRadius = Math.min(this.circleCenterX, this.circleCenterY) - 50;

    // Size of touch node graphic.
    this.nodeSize = 30;
    // different size for main point
    this.nodeSizeMain = this.nodeSize*1.5;

    this.activeBorderColor = '#000';
    this.customColors = [ '#845ec2', '#d65db1', '#ff6f91', '#ff9671',
                          '#ffc75f', '#f9f871', '#2f4858', '#2e6775' ];

    // defines what is sent in the transmit function (actually in the processToTransmit function)
    // 0 : send all information on points
    // 1 : send information of current active point only
    this.transmitMode = 1;

    // set the head orientation relative to the zero degree axis (on top)
    this.headOrientation = 0;
    // calculate the angles relative to the head or to the zero degree axis
    this.angleRelativeToHead = false;

    // defines if it is possible to edit points with clicking
    this.clickable = true;

    // defines if it is possible to create new points with clicking
    this.newPointsGeneratable = true;

    this.init();

    this.render();

  }

  buildInterface() {


    this.backgroundCircle = svg.create('circle');

    this.element.appendChild(this.backgroundCircle);

    this.listener = svg.create('circle');

    this.element.appendChild(this.listener);

    this.sourceElements = [];
    this.labelElements = [];
  }

  sizeInterface() {
    this.backgroundCircle.setAttribute('cx',this.circleCenterX);
    this.backgroundCircle.setAttribute('cy',this.circleCenterY);
    this.backgroundCircle.setAttribute('r', this.bgRadius);
    this._minDimension = Math.min(this.width,this.height);

    this.listener.setAttribute('cx',this.circleCenterX);
    this.listener.setAttribute('cy',this.circleCenterY);

    this.listener.setAttribute('r', this.nodeSizeMain);

    this.render();

  }

  colorInterface() {
    this.backgroundCircle.setAttribute('fill', this.colors.fill);

    this.listener.setAttribute('fill', this.colors.mediumLight);
  }

  render() {
  }


  click() {


    if (this.clickable) {

      this.setActivePoint(this.mouse.x, this.mouse.y);
      if (this.newPointsGeneratable) {
        if (this.activePoint == undefined) {

          this.generateNewPoint(this.mouse.x, this.mouse.y, "Point " + (this.val.length+1), this.currentColorIndex);
        }
      }

      this.scaleNode();

      this.processToTransmit();

      this.move();
    }
  }

  move() {
    if (this.clickable) {

      if (this.clicked) {
        if (this.activePoint!=undefined) {
          this.val[this.activePoint].x = this.mouse.x;
          this.val[this.activePoint].y = this.mouse.y;

          this.scaleNode();

          this.drawEmphasisCircle();

          this.sourceElements[this.activePoint].setAttribute('cx',this.val[this.activePoint].x);
          this.sourceElements[this.activePoint].setAttribute('cy',this.val[this.activePoint].y);

          this.labelElements[this.activePoint].setAttribute('x',this.val[this.activePoint].x);
          this.labelElements[this.activePoint].setAttribute('y',this.val[this.activePoint].y + this.nodeSize + 20);


        }

        this.processToTransmit();
        this.render();
      }
    }
  }

  release() {
    if (this.clickable) {
      this.scaleNode();
      this.processToTransmit();
      this.render();
    }
  }

  get normalized() {
    return {
      x: this.value.x.normalized,
      y: this.value.y.normalized
    };
  }


  addNewPoint(distance, angle, label, colorIndex) {

    // adapt angle to head
    angle -= 90;

    if(angle >= 360) {
      angle -= 360;
    }

    let tempPoint = this.polToCar(distance, angle);

    tempPoint.x = this.convertToPixels(tempPoint.x);
    tempPoint.y = this.convertToPixels(tempPoint.y);

    // translate
    tempPoint.x += this.circleCenterX;
    tempPoint.y += this.circleCenterY;

    this.generateNewPoint(tempPoint.x, tempPoint.y, label, colorIndex);

    this.drawEmphasisCircle();

  }

  moveExistingPoint(pointIndex, distance, angle) {

    // adapt angle to head
    angle -= 90;

    if(angle >= 360) {
      angle -= 360;
    }

    var newCoordinates = this.polToCar(distance, angle);

    newCoordinates.x = this.convertToPixels(newCoordinates.x);
    newCoordinates.y = this.convertToPixels(newCoordinates.y);

    // translate
    newCoordinates.x += this.circleCenterX;
    newCoordinates.y += this.circleCenterY;


    this.val[pointIndex].x = newCoordinates.x;
    this.val[pointIndex].y = newCoordinates.y;

    this.sourceElements[pointIndex].setAttribute('cx', this.val[pointIndex].x);
    this.sourceElements[pointIndex].setAttribute('cy', this.val[pointIndex].y);

    this.labelElements[pointIndex].setAttribute('x', this.val[pointIndex].x);
    this.labelElements[pointIndex].setAttribute('y', this.val[pointIndex].y + this.nodeSize + 20);


    this.scaleNode();

  }

  changeColorIndexOfActivePoint(colorIndex) {
    if (this.activePoint != undefined) {
      this.val[this.activePoint].colorIndex = colorIndex;
      this.sourceElements[this.activePoint].setAttribute('fill', this.customColors[colorIndex]);
    }
  }

  generateNewPoint(x, y, label, colorIndex) {
    this.val.push(new Point(x, y, label, colorIndex));

    this.setActivePoint(x, y);
    this.scaleNode();

    let sourceElement = svg.create('circle');

    sourceElement.setAttribute('cx', this.val[this.activePoint].x);
    sourceElement.setAttribute('cy', this.val[this.activePoint].y);
    sourceElement.setAttribute('r', this.nodeSize);
    sourceElement.setAttribute('fill-opacity', '0.5');
    sourceElement.setAttribute('fill', this.customColors[colorIndex]);
    sourceElement.setAttribute('stroke', 'none');

    let labelElement = svg.create('text');
    labelElement.setAttribute('x', this.val[this.activePoint].x);
    labelElement.setAttribute('y', this.val[this.activePoint].y + this.nodeSize + 20);
    labelElement.setAttribute('fill', 'black');
    labelElement.setAttribute('text-anchor', 'middle');
    labelElement.textContent = this.val[this.activePoint].label;

    this.element.appendChild(sourceElement);
    this.element.appendChild(labelElement);

    this.sourceElements.push(sourceElement);
    this.labelElements.push(labelElement);
  }

  setActivePoint(x,y) {
    var temp;
    for (let i = 0; i < this.val.length; i++) {
      let maxX, maxY, minX, minY;

      maxX = this.val[i].x + this.nodeSize;
      minX = this.val[i].x - this.nodeSize;

      maxY = this.val[i].y + this.nodeSize;
      minY = this.val[i].y - this.nodeSize;


      if (x <= maxX && x >= minX && y <= maxY && y >= minY) {
        temp = i;
      }
    }
    this.activePoint = temp;
  }

  drawEmphasisCircle() {
    this.sourceElements[this.activePoint].setAttribute('stroke', this.activeBorderColor);
    for (var i = 0; i < this.sourceElements.length; i++) {
      if (i!=this.activePoint) {
        this.sourceElements[i].setAttribute('stroke', 'none');
        // console.log('in here');
      }
    }
  }

  scaleNode() {
    if (this.activePoint!=undefined) {
      var clippedX = this.val[this.activePoint].x;
      var clippedY = this.val[this.activePoint].y;

      var distquad = ((clippedX-this.circleCenterX)*(clippedX-this.circleCenterX))+((clippedY-this.circleCenterY)*(clippedY-this.circleCenterY));

      if (distquad>(this.bgRadius*this.bgRadius)) {

        var realX = this.val[this.activePoint].x-this.circleCenterX;
        var realY = this.val[this.activePoint].y-this.circleCenterY;

        var angle = Math.atan2(realY, realX);

        clippedX = this.bgRadius * Math.cos(angle);
        clippedY = this.bgRadius * Math.sin(angle);

        // translate
        clippedX += this.circleCenterX;
        clippedY += this.circleCenterY;
      }

      this.val[this.activePoint].x = clippedX;
      this.val[this.activePoint].y = clippedY;
    }
  }

  processToTransmit() {
    var transmitData;
    if(this.transmitMode == 0) {

      // calculate distances and angles
      let distances = [];
      let angles = [];

      for(let i = 0; i < this.val.length; i++) {
        distances.push(this.calculateDistance(this.listenerPoint, this.val[i]));
        angles.push(this.calculateAngle(this.val[i]));
      }


      transmitData = {
        angles: angles,
        distances: distances
      };
    } else if(this.transmitMode == 1) {
      if (this.activePoint != undefined) {
        let distance = this.calculateDistance(this.listenerPoint, this.val[this.activePoint]);
        let angle = this.calculateAngle(this.val[this.activePoint]);

        transmitData = {
          pointIndex: this.activePoint,
          angle: angle,
          distance: distance
        };
      } else {
        return;
      }
    }
    this.transmit(transmitData);
  }

  removeActivePoint() {
    if (this.activePoint != undefined) {

      this.sourceElements[this.activePoint].remove();
      this.sourceElements.splice(this.activePoint, 1);

      this.labelElements[this.activePoint].remove();
      this.labelElements.splice(this.activePoint, 1);

      this.val.splice(this.activePoint, 1);
      this.activePoint = undefined;

    }
  }
  removeAllPoints() {
    let numberOfPoints = this.val.length;
    for (var i = 0; i < numberOfPoints; i++) {
      this.val.splice(0, 1);
      this.sourceElements[0].remove();
      this.sourceElements.splice(0, 1);

      this.labelElements[0].remove();
      this.labelElements.splice(0, 1);
    }
    this.activePoint = undefined;
  }
  convertToMeters(pixels) {
    let meters = pixels/this.meterScale;
    return meters;
  }
  convertToPixels(meters) {
    let pixels = meters*this.meterScale;
    return pixels;
  }
  polToCar(distance, angleDeg) {
    var angleRad = angleDeg / 180.0 * Math.PI;

    var newX = distance * Math.cos(angleRad);
    var newY = distance * Math.sin(angleRad);

    return {
      x: newX,
      y: newY
    };
  }
  calculateDistance(pointA, pointB) {
    var distX = pointB.x-pointA.x;
    var distY = pointB.y-pointA.y;
    var lengthInPx = Math.sqrt(distX*distX+distY*distY);
    var lengthInM = this.convertToMeters(lengthInPx);
    return lengthInM;
  }
  calculateAngle(pointXY) {
    var realX = pointXY.x-this.circleCenterX;
    var realY = pointXY.y-this.circleCenterY;

    var angle = Math.atan2(realY, realX) * 180 / Math.PI;

    if(angle < 0) {
      angle += 360;
    }

    angle += 90;

    if(angle >= 360) {
      angle -= 360;
    }

    if (this.angleRelativeToHead) {
      // adapt to head
      angle -= this.headOrientation;
      if(angle < 0) {
        angle += 360;
      }
    }
    return angle;

  }

  transmit(transmitData) {
    this.emit('change', transmitData);
  }

}
