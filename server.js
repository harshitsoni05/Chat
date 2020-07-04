#!/usr/bin/env node

var fs = require('fs'),
    tty = require('tty'),
    statik = require('node-static');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 9090}); 
var users = {};

    var argv = require('optimist')
        .usage([
            'USAGE: $0 [-p <port>] [<directory>]',
            'simple, rfc 2616 compliant file streaming module for node']
            .join('\n\n'))
        .option('port', {
            alias: 'p',
            'default': 8080,
            description: 'TCP port at which the files will be served'
        })
        .option('host-address', {
            alias: 'a',
            'default': '127.0.0.1',
            description: 'the local network interface at which to listen'
        })
        .option('cache', {
            alias: 'c',
            description: '"Cache-Control" header setting, defaults to 3600'
        })
        .option('version', {
            alias: 'v',
            description: 'node-static version'
        })
        .option('headers', {
            alias: 'H',
            description: 'additional headers (in JSON format)'
        })
        .option('header-file', {
            alias: 'f',
            description: 'JSON file of additional headers'
        })
        .option('gzip', {
            alias: 'z',
            description: 'enable compression (tries to serve file of same name plus \'.gz\')'
        })
        .option('spa', {
            description: 'serve the content as a single page app by redirecting all non-file requests to the index html file'
        })
        .option('indexFile', {
            alias: 'i',
            'default': 'index.html',
            description: 'specify a custom index file when serving up directories'
        })
        .option('help', {
            alias: 'h',
            description: 'display this help message'
        })
        .argv;

    var dir = argv._[0] || '.';

    var colors = require('colors');

    var log = function(request, response, statusCode) {
        var d = new Date();
        var seconds = d.getSeconds() < 10? '0'+d.getSeconds() : d.getSeconds(),
            datestr = d.getHours() + ':' + d.getMinutes() + ':' + seconds,
            line = datestr + ' [' + response.statusCode + ']: ' + request.url,
            colorized = line;
        if (tty.isatty(process.stdout.fd))
            colorized = (response.statusCode >= 500) ? line.red.bold :
                        (response.statusCode >= 400) ? line.red :
                        line;
        console.log(colorized);
    };

    var file, options;

if (argv.help) {
    require('optimist').showHelp(console.log);
    process.exit(0);
}

if (argv.version) {
    console.log('node-static', statik.version.join('.'));
    process.exit(0);
}

if (argv.cache) {
    (options = options || {}).cache = argv.cache;
}

if (argv.headers) {
    (options = options || {}).headers = JSON.parse(argv.headers);
}

if (argv['header-file']) {
    (options = options || {}).headers =
        JSON.parse(fs.readFileSync(argv['header-file']));
}

if (argv.gzip) {
    (options = options || {}).gzip = true;
}

if (argv.indexFile) {
    (options = options || {}).indexFile = argv['indexFile'];
}

file = new(statik.Server)(dir, options);

require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        var callback = function(e, rsp) {
          if (e && e.status === 404) {
              response.writeHead(e.status, e.headers);
              response.end("Not Found");
              log(request, response);
          } else {
              log(request, response);
          }
        };

        if (argv['spa'] && request.url.indexOf(".") == -1) {
            file.serveFile(argv['indexFile'], 200, {}, request, response);
        } else {
            file.serve(request, response, callback);
        }
    }).resume();
}).listen(+argv.port, argv['host-address']);

console.log('serving "' + dir + '" at http://' + argv['host-address'] + ':' + argv.port);
if (argv.spa) {
  console.log('serving as a single page app (all non-file requests redirect to ' + argv['indexFile'] +')');
}
wss.on('connection', function(connection) {
  
   console.log("User connected");
	 
   //when server gets a message from a connected user 
   connection.on('message', function(message) {
	 
      var data; 
      //accepting only JSON messages 
      try { 
         data = JSON.parse(message); 
      } catch (e) { 
         console.log("Invalid JSON"); 
         data = {}; 
      }
		  
      //switching type of the user message 
      switch (data.type) { 
         //when a user tries to login 
         case "login": 
            console.log("User logged", data.name); 
            //if anyone is logged in with this username then refuse 
            if(users[data.name]) { 
               sendTo(connection, { 
                  type: "login", 
                  success: false 
               }); 
            } else { 
               //save user connection on the server 
               users[data.name] = connection; 
               connection.name = data.name; 
					
               sendTo(connection, { 
                  type: "login", 
                  success: true 
               }); 
            }
				
            break;
				
         case "offer": 
            //for ex. UserA wants to call UserB 
            console.log("Sending offer to: ", data.name); 
				
            //if UserB exists then send him offer details 
            var conn = users[data.name]; 
				
            if(conn != null) { 
               //setting that UserA connected with UserB 
               connection.otherName = data.name; 
					
               sendTo(conn, { 
                  type: "offer", 
                  offer: data.offer, 
                  name: connection.name 
               }); 
            } 
				
            break;
				
         case "answer": 
            console.log("Sending answer to: ", data.name); 
            //for ex. UserB answers UserA 
            var conn = users[data.name]; 
				
            if(conn != null) { 
               connection.otherName = data.name; 
               sendTo(conn, { 
                  type: "answer", 
                  answer: data.answer 
               }); 
            } 
				
            break;
				
         case "candidate": 
            console.log("Sending candidate to:",data.name);
            var conn = users[data.name];  
				
            if(conn != null) { 
               sendTo(conn, { 
                  type: "candidate", 
                  candidate: data.candidate 
               }); 
            } 
				
            break;
				
         case "leave": 
            console.log("Disconnecting from", data.name); 
            var conn = users[data.name]; 
            conn.otherName = null; 
				
            //notify the other user so he can disconnect his peer connection 
            if(conn != null) { 
               sendTo(conn, { 
                  type: "leave"
               });
            }  
				
            break;
				
         default: 
            sendTo(connection, { 
               type: "error", 
               message: "Command not found: " + data.type 
            }); 
				
            break;
				
      }  
   });
	
   //when user exits, for example closes a browser window 
   //this may help if we are still in "offer","answer" or "candidate" state 
   connection.on("close", function() { 
	
      if(connection.name) { 
         delete users[connection.name]; 
			
         if(connection.otherName) { 
            console.log("Disconnecting from ", connection.otherName); 
            var conn = users[connection.otherName]; 
            conn.otherName = null;
				
            if(conn != null) { 
               sendTo(conn, { 
                  type: "leave" 
               }); 
            }  
         } 
      } 
   });
	
   connection.send("Hello world");
	
});
  
function sendTo(connection, message) { 
   connection.send(JSON.stringify(message)); 
}