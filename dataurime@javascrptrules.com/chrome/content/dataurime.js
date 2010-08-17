if (typeof Cc == "undefined") {
        var Cc = Components.classes;
}
if (typeof Ci == "undefined") {
        var Ci = Components.interfaces;
}
if (typeof CCIN == "undefined") {
        function CCIN(cName, ifaceName){
                return Cc[cName].createInstance(Ci[ifaceName]);
        }
}
if (typeof CCSV == "undefined") {
        function CCSV(cName, ifaceName){
                if (Cc[cName])
                        // if fbs fails to load, the error can be _CC[cName] has no properties
                        return Cc[cName].getService(Ci[ifaceName]);
                else
                        dumpError("CCSV fails for cName:" + cName);
        };
}

function TracingListener() {
}

TracingListener.prototype = {
    originalListener: null,
    receivedData: null,   //will be an array for incoming data.
    imgs: null,
    imgLoading: 'data:image/gif;charset=UTF-8;base64,R0lGODlhEAAQAPIAAP///wAAAMLCwkJCQgAAAGJiYoKCgpKSkiH+GkNyZWF0ZWQgd2l0aCBhamF4&#xd; bG9hZC5pbmZvACH5BAAKAAAAIf8LTkVUU0NBUEUyLjADAQAAACwAAAAAEAAQAAADMwi63P4wyklr&#xd; E2MIOggZnAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQACgABACwAAAAA&#xd; EAAQAAADNAi63P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUk&#xd; KhIAIfkEAAoAAgAsAAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9&#xd; HMaoKwJZ7Rf8AYPDDzKpZBqfvwQAIfkEAAoAAwAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYum&#xd; CYUhDAQxRIdhHBGqRoKw0R8DYlJd8z0fMDgsGo/IpHI5TAAAIfkEAAoABAAsAAAAABAAEAAAAzII&#xd; unInK0rnZBTwGPNMgQwmdsNgXGJUlIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQACgAF&#xd; ACwAAAAAEAAQAAADMwi6IMKQORfjdOe82p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJ&#xd; ibufbSlKAAAh+QQACgAGACwAAAAAEAAQAAADMgi63P7wCRHZnFVdmgHu2nFwlWCI3WGc3TSWhUFG&#xd; xTAUkGCbtgENBMJAEJsxgMLWzpEAACH5BAAKAAcALAAAAAAQABAAAAMyCLrc/jDKSatlQtScKdce&#xd; CAjDII7HcQ4EMTCpyrCuUBjCYRgHVtqlAiB1YhiCnlsRkAAAOwAAAAAAAAAAAA==&#xd;',

    //For the listener this is step 1.
    onStartRequest: function(request, context) {
        this.receivedData = []; //initialize the array
        this.keys = {};
        this.imgs = [];

        //Pass on the onStartRequest call to the next listener in the chain -- VERY IMPORTANT
        this.originalListener.onStartRequest(request, context);
    },
    //This is step 2. This gets called every time additional data is available
    onDataAvailable: function(request, context, inputStream, offset, count) {
       var binaryInputStream = CCIN("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
        binaryInputStream.setInputStream(inputStream);

        var storageStream = CCIN("@mozilla.org/storagestream;1", "nsIStorageStream");
        //8192 is the segment size in bytes, count is the maximum size of the stream in bytes
        storageStream.init(8192, count, null); 

        var binaryOutputStream = CCIN("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream");
        binaryOutputStream.setOutputStream(storageStream.getOutputStream(0));

        // Copy received data as they come.
        var data = binaryInputStream.readBytes(count);
        if (request.contentType === 'text/html') {
            try {
            var that = this;
            //data = data.replace(/(<img )[^>]*src=["']?([^> "']*)["']?[^>]*>/g, function (m, g1, g2) {that.imgs.push(g2); that.keys[g2] = 0; return m.replace(g1, '<img dataid="' + that.imgs.length + '" ').replace(g2, that.imgLoading);});
            //count = data.length;
            Firebug.Console.log(data);
            Firebug.Console.log(request);
            } catch (e) {
                Firebug.Console.log(e);
            }
        }

        this.receivedData.push(data);

        binaryOutputStream.writeBytes(data, count);

        //Pass it on down the chain
        this.originalListener.onDataAvailable(request, context, storageStream.newInputStream(0), offset, count);
    },

    onStopRequest: function(request, context, statusCode) {
        try {
        //QueryInterface into HttpChannel to access originalURI and requestMethod properties
        request.QueryInterface(Ci.nsIHttpChannel);

        if (request.originalURI && this.imgs.length) {
            Firebug.Console.log(this.imgs);

            var that = this;
            var req = new XMLHttpRequest;
            var requestURL = 'http://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20data.uri%20where%20url%20in%20("' + this.imgs.map(function (i) {return encodeURIComponent(i);}).join('","') + '")&format=xml&_maxage=300';
            req.open('GET', requestURL, true);
            req.onload = function () {
                try {
                if (req.status == 200) {
                    var i, d, len,
                        doc = content.document,
                        images = doc.images,
                        keys = that.keys,
                        imgs = that.imgs,
                        //JSON = CCIN('@mozilla.org/dom/json;1', 'nsIJSON'),
                        //data = JSON.decode(req.responseText);
                        data = req.responseXML.documentElement.lastChild.children;
                    Firebug.Console.log(req.responseXML);
                    Firebug.Console.log(data);
                    for (i = 0, len = images.length; i < len; i++) {
                        d = data[i];
                        if (d.tagName === 'url') {
                            images[i].src = d.textContent;
                        } else {
                            images[i].src = imgs[i];
                        }
                    }
                    /*url = data.query.diagnostics.url;
                    for (i = 0, len = url.length; i < len); i++ {
                        keys[url[i].content] = 1;
                    }
                    url = data.query.results.url;
                    for (i in keys) {
                        if (keys[i]) {
                            doc.getElementById(i).src = url[j++];
                        }
                    }*/
                }
                } catch (e) {
                    Firebug.Console.log(e);
                }
            };
            req.send(null);
        }
        }
        catch (e) {
            dumpError(e);
        }

        //Pass it on down the chain
        this.originalListener.onStopRequest(request, context, statusCode);
    },

    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIStreamListener) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Components.results.NS_NOINTERFACE;
    },

    readPostTextFromRequest : function(request, context) {
        try {
                var is = request.QueryInterface(Ci.nsIUploadChannel).uploadStream;
                if (is) {
                    var ss = is.QueryInterface(Ci.nsISeekableStream);
                    var prevOffset;
                    if (ss) {
                        prevOffset = ss.tell();
                        ss.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
                    }

                    // Read data from the stream..
                    var charset = "UTF-8";
                    var text = this.readFromStream(is, charset, true);

                    if (ss && prevOffset == 0) {
                        ss.seek(Ci.nsISeekableStream.NS_SEEK_SET, 0);
                    }

                    return text;
                }
                else {
                    dump("Failed to Query Interface for upload stream.\n");
                }
            }
            catch(exc) {
                        dumpError(exc);
            }

            return null;
    },

    readFromStream: function(stream, charset, noClose) {
        var sis = CCSV("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream");
        sis.setInputStream(stream);

        var segments = [];
        for (var count = stream.available(); count; count = stream.available()) {
            segments.push(sis.readBytes(count));
        }

        if (!noClose) {
            sis.close();
        }

        var text = segments.join("");
        return text;
    }
};

httpRequestObserver = {
    observe: function(request, aTopic, aData){
        if (typeof Cc == "undefined") {
                var Cc = Components.classes;
        }
        if (typeof Ci == "undefined") {
                var Ci = Components.interfaces;
        }
        if (aTopic == "http-on-examine-response") {
            request.QueryInterface(Ci.nsIHttpChannel);

            /*if (request.originalURI
                && piratequesting.baseURL == request.originalURI.prePath
                && request.originalURI.path.indexOf("/index.php?ajax=") == 0) {*/
                    var newListener = new TracingListener();
                    request.QueryInterface(Ci.nsITraceableChannel);
                    newListener.originalListener = request.setNewListener(newListener);
            //}
        }
    },

    QueryInterface: function(aIID) {
        if (typeof Cc == "undefined") {
            var Cc = Components.classes;
        }
        if (typeof Ci == "undefined") {
            var Ci = Components.interfaces;
        }
        if (aIID.equals(Ci.nsIObserver) || aIID.equals(Ci.nsISupports)) {
            return this;
        }

        throw Components.results.NS_NOINTERFACE;
    }
};

var observerService = Cc["@mozilla.org/observer-service;1"] .getService(Ci.nsIObserverService);
observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);
