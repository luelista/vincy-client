
function BinaryBuffer(inStream) {
  this.buffer = new Buffer([]);
  this.pendingBytes = 0;
  this.pendingCallback = null;
  this.pendingType = "";
  this.inStream = inStream;
  this.debugName = false;
  
  this.onData = (function(data) {
    this.write(data);
  }.bind(this));
  if (inStream) {
    inStream.on('data', this.onData);
  }
}


BinaryBuffer.prototype.stopListening = function() {
  this.inStream.removeListener('data', this.onData);
}

BinaryBuffer.prototype.write = function(data) {
  this.buffer = Buffer.concat([this.buffer, data], this.buffer.length+data.length);
  if(this.debugName)console.log(this.debugName, this.buffer)
  this.process();
}

BinaryBuffer.datatypeShortcuts = {
  byte: [ "readUInt8", 1],
  word: [ "readUInt16BE", 2],
  dword: ["readUInt32BE", 4]
}

BinaryBuffer.prototype.request = function(bytes, callback) {
  //console.log(this.debugName,"request called",bytes)
  if (typeof bytes == "number") {
    this.pendingType = "";
    this.pendingBytes = bytes;
  } else if (bytes in BinaryBuffer.datatypeShortcuts) {
    this.pendingType = BinaryBuffer.datatypeShortcuts[bytes][0];
    this.pendingBytes = BinaryBuffer.datatypeShortcuts[bytes][1];
  } else {
    throw "BinaryBuffer: Invalid request type";
  }
  this.pendingCallback = callback;
  this.process();
}

BinaryBuffer.prototype.process = function() {
  if (this.pendingCallback != null && this.pendingBytes <= this.buffer.length) {
    if(this.debugName)console.log(this.debugName, "Processing "+this.pendingBytes+" bytes as "+this.pendingType+": (str="+this.buffer.toString("ascii",0,this.pendingBytes).replace(/[^ a-zA-Z0-9:]/g, function(x){return "\\x"+x[0].charCodeAt(0).toString(16)})+")");
    var result = this.buffer.slice(0, this.pendingBytes);
    this.buffer = this.buffer.slice(this.pendingBytes);
    if (this.pendingType) {
      result = result[this.pendingType](0);
    }
    if(this.debugName)console.log("           = ", result);
    var cb = this.pendingCallback;
    this.pendingCallback = null;
    this.pendingBytes = 0;
    cb(result);
  }
}

BinaryBuffer.writeVbStr = function(toBuffer, string, enc) {
  var bl = Buffer.byteLength(string, enc);
  var buf = new Buffer(2+bl);
  buf.writeUInt16BE(bl, 0);
  buf.write(string, 2, enc);
  toBuffer.write(buf);
}

BinaryBuffer.writeWord = function(toBuffer, integer) {
  var buf = new Buffer(2);
  buf.writeUInt16BE(integer, 0);
  toBuffer.write(buf);
}

module.exports = BinaryBuffer;
