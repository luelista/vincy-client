(function() {
  var nw = require('nw.gui');
  
  App.MainWindow = {};
  var self = App.MainWindow;
  App.servers = [];
  
  function makeDropdownMenu(title) {
    var m = new nw.MenuItem({ label: title });
    m.submenu = new nw.Menu();
    return m;
  }
  
  function initMainMenu() {
    var win = nw.Window.get();
    win.title = "ViNCy-ng " + nw.App.manifest.version;
    var nativeMenuBar = new nw.Menu({ type: "menubar" });
    
    var appMenu, aIndex, accountMenu, windowMenu, wIndex,editMenu;
    var mod;
    
    if (process.platform === "darwin") {
      mod = "cmd";
      nativeMenuBar.createMacBuiltin("ViNCy");
      appMenu = nativeMenuBar.items[0].submenu; aIndex=2;
      windowMenu = nativeMenuBar.items[2].submenu; wIndex=3;
      nativeMenuBar.insert(makeDropdownMenu("Account"), 1);
      accountMenu = nativeMenuBar.items[1].submenu;
      windowMenu.insert(new nw.MenuItem({ type: "separator" }), wIndex++);
      editMenu = nativeMenuBar.items[2].submenu;
    } else {
      mod = "ctrl";
      nativeMenuBar.append(makeDropdownMenu("Server"));
      nativeMenuBar.append(makeDropdownMenu("View"));
      nativeMenuBar.append(makeDropdownMenu("Tools"));
      nativeMenuBar.append(makeDropdownMenu("Window"));
      accountMenu = nativeMenuBar.items[0].submenu;
      appMenu = nativeMenuBar.items[2].submenu; aIndex=0;
      windowMenu = nativeMenuBar.items[3].submenu; wIndex=0;
      editMenu = nativeMenuBar.items[1].submenu;
    }
    
    
    appMenu.insert(new nw.MenuItem({
      label: "Preferences", modifiers: mod, key: ",",
      click: function() {
        App.MainWindow.showPreferences();
      }
    }), aIndex++);
    appMenu.insert(new nw.MenuItem({ type: "separator" }), aIndex++);
    
    
    accountMenu.append(new nw.MenuItem({
      label: "Add new account ...", modifiers: mod+"-shift", key: "n",
      click: function() {
        self.showAddAccount();
      }
    }));
    accountMenu.append(new nw.MenuItem({ type: "separator" }));
    accountMenu.append(new nw.MenuItem({
      label: "Connect via VNC", modifiers: mod, key: "k",
      click: function() { self.connectToHost(); }
    }));
    accountMenu.append(new nw.MenuItem({
      label: "Connect via Remote Desktop",
      click: function() { connectToHost2(false); }
    }));
    accountMenu.append(new nw.MenuItem({
      label: "Wake on lan", modifiers: mod, key: "m",
      click: function() { self.wakeUpHost(); }
    }));
    accountMenu.append(new nw.MenuItem({
      label: "Show info", modifiers: mod, key: "i",
      click: function() { self.showHostInfo(); }
    }));

    editMenu.append(new nw.MenuItem({
      label: "Refresh host list", modifiers: mod, key: "r",
      click: function() { self.loadHostlists(); }
    }));
    
    windowMenu.insert(new nw.MenuItem({
      label: "Inspector", modifiers: mod, key: "j",
      click: function() {
        nw.Window.get().showDevTools();
      }
    }), wIndex++);
    windowMenu.insert(new nw.MenuItem({
      label: "Connection list", modifiers: mod, key: "l",
      click: function() {
        openModal("modal_connectionList");
      }
    }), wIndex++);
    
    
    win.menu = nativeMenuBar;
    
  }
  
  self.showPreferences = function() {
    openModal("modal_preferences");
    var $m = $("#modal_preferences");
    $m.find(".f-username").val(App.config.prefs_username);
    $m.find(".f-password").val(App.config.prefs_password);
    $m.find(".f-clientkey").val(App.config.clientKey);
    $m.find(".f-vncviewerexec").val(App.config.prefs_vncViewerExecutable);
  };
  function savePreferences() {
    var $m = $("#modal_preferences");
    App.config.prefs_username = $m.find(".f-username").val();
    App.config.prefs_password = $m.find(".f-password").val();
    App.config.prefs_vncViewerExecutable = $m.find(".f-vncviewerexec").val();
    $("#modal_preferences").foundation("reveal", "close");
  }
  
  
  
  self.initApp = function() {
    initMainMenu();
    // self.loadConfig(); ...called earlier
    self.refreshAccountList();
    self.loadHostlists();
    self.attachEvents();
    setInterval(self.loadHostlists, 60000);
    if (App.config.firstStart !== false) {
      self.showPreferences();
      App.config.firstStart = false;
      self.storeConfig();
    }
  }
  
  function onExitApp() {
    console.log("onExitApp")
    self.storeConfig();
    var win = nw.Window.get();
    win.close(true);
  }
  
  self.attachEvents = function() {
    $("#contentView").on("click", "tr", onHostlistItemClick);
    $("#accountList_addAccount").click(self.showAddAccount);
    $("#drop_accountList").on("click", ".action", function() {
      var server = App.servers[+$(this).closest("[data-index]").attr("data-index")];
      self.showEditAccount(server);
    });
    $("#drop_accountList").on("click", ".errmes", function() { self.loadHostlists(); });
    $("#tb_hostCommands .f-connect").click(self.connectToHost);
    $("#tb_hostCommands .f-wakeup").click(self.wakeUpHost);
    $("#tb_hostCommands .f-hostinfo").click(self.showHostInfo);
    $("#contentView").on("click", ".f-connect", self.connectToHost);
    $("#contentView").on("click", ".f-wakeup", self.wakeUpHost);
    $(".f-closemodal-btn").on("click", function() { $(this).closest(".reveal-modal").foundation("reveal", "close"); })
    $("#modal_addAccount .f-ok-btn").click(saveAccountInfo);
    $("#modal_addAccount .f-trash-btn").click(deleteAccountInfo);
    $("#modal_preferences .f-ok-btn").click(savePreferences);
    $("#tbBtn_preferences").click(self.showPreferences);
    $(".f-reveal-password").click(revealPassword);
    var win = nw.Window.get();
    win.on("close", onExitApp);
  }
  function revealPassword() {
    var $pw=$(this).closest("form").find(".f-password");
    $pw.attr("type", $pw.attr("type")=="password" ? "text" : "password");
  }
  
  
  //-->  server/account lists
  
  
  self.accountListTemplate = _.template("<div data-index='<%- index %>'> \
      <i class='fa fa-<%= loading ? 'spinner fa-spin' : (error != null ? 'exclamation-triangle' : 'cube') %>' ></i>\
      <%- url.hostname  %> \
      <span class='pull-right'><a href='#' class=action><i class='fa fa-cog'></i></a>\
      </span>\
      </div><%= error != null ? '<div class=errmes>'+error+' (click to retry)</div>' : '' %>");

  
  self.refreshAccountList = function() {
    var $al = $("#accountList");
    $al.html("");
    for(var i = 0; i < App.servers.length; i++) {
      var d = App.servers[i]; d.index=i;
      $al.append(self.accountListTemplate(d));
    }
  }
  
  self.showAddAccount = function() {
    self.showAccountForm(true);
    currentEditingAccount = null;
  }
  self.showEditAccount = function(server) {
    currentEditingAccount = server;
    var $modal = self.showAccountForm(false);
    $modal.find(".f-url").val(server.urlViewString());
    try {
      $modal.find(".f-fingerprint").val(server.fingerprint);
      var auth = server.url.auth.split(/:/);
      $modal.find(".f-username").val(auth[0]);
      $modal.find(".f-password").val(auth[1]);
    } catch(ex) {
      console.log(ex);
    }
    if (server.error&&server.error.conError) $modal.find(".alert-box.alert").html(server.error.conError).show();
    else if (server.error&&server.error.conWarning) $modal.find(".alert-box.info").html(server.error.conWarning).show();
    else if (server.error) $modal.find(".alert-box.info").html("<i class='fa fa-exclamation-circle' style='font-size:14pt'></i> "+server.error).show();
  }
  
  self.showAccountForm = function(isNewAcc) {
    var $modal = $("#modal_addAccount");
    openModal("modal_addAccount");
    $modal.find("h3").html(isNewAcc ? "Add server" : "Edit server");
    $modal.find("input[type=text],input[type=password]").val("");
    $modal.find(".alert-box").hide();
    if(isNewAcc) $modal.find(".f-trash-btn").hide(); else $modal.find(".f-trash-btn").show();
    return $modal;
  }
  
  var currentEditingAccount = null;
  
  function saveAccountInfo() {
    if (!currentEditingAccount) {
      currentEditingAccount = new App.VincyServer();
      currentEditingAccount.key = "id" + (+new Date());
      App.servers.push(currentEditingAccount);
    }
    currentEditingAccount.fingerprint = $("#modal_addAccount .f-fingerprint").val();
    currentEditingAccount.setUrl($("#modal_addAccount .f-url").val(),
                                 $("#modal_addAccount .f-username").val(),
                                 $("#modal_addAccount .f-password").val());
    //...
    self.storeConfig();
    self.refreshAccountList();
    self.loadHostlists();
    $("#modal_addAccount").foundation("reveal", "close");
  }
  
  function deleteAccountInfo() {
    delete App.servers[currentEditingAccount.key];
    self.storeConfig();
    self.refreshAccountList();
    self.loadHostlists();
    $("#modal_addAccount").foundation("reveal", "close");
  }
  
  //--> manage host lists
  
  self.hostListItemTemplate = _.template("<tr> "
    +  "<td><i class='fa fa-desktop'></i> <%- id  %></td> "
    +  "<td><i class='fa fa-circle' style='color:<%= (online ? 'green' : 'gray') %>'></i> <%= (online ? 'online' : 'n/a') %></td>"
    +  "<td><%- hostname  %></td> "
    //+  "<td><%- group  %></td> "
    //+  "<td><%- macaddr %></td> "
    +  "<td><%- comment %></td> "
    +  "<td class=actions><a href='#' class='action f-connect' title='Connect'><i class='fa fa-eye'></i></a> <a href='#' class='action f-wakeup' title='Wake up host'><i class='fa fa-power-off'></i></a> </td> "
    +  "</tr>");

  
  self.hostListGroupheaderTemplate = _.template("<tr> \
      <th colspan=5><i class='fa fa-cube'></i> <%- group %> <span style=color:red;font-weight:normal;font-size:8pt;float:right><%- errMes %></span></th>\
      </tr>");
  
  self.refreshHostlists = function() {
    self.selectedHost = null;    self.selectedHostServer = null; self.onHostSelected();
    var $al = $("#contentView");
    $al.html("<thead class=thead><tr>"
      + "<th>ID</th>"
      + "<th>Status</th>"
      + "<th>Hostname</th>"
      //+ "<th>Group</th>"
      //+ "<th>MAC Address</th>"
      + "<th>Comment</th><th></th></tr></thead>");
    for(var i = 0; i < App.servers.length; i++) {
      var server = App.servers[i];
      $al.append(self.hostListGroupheaderTemplate({ group: server.url.hostname, errMes: server.error }));
      for(var j in server.hosts) {
        var d = server.hosts[j];
        var $item = $(self.hostListItemTemplate(d)); $item[0].hostInfo = d; $item[0].serverInfo = server;
        $al.append($item);
      }
    }
  }
  
  self.loadHostlists = function() {
    App.servers.forEach(function(server) {
      server.loading=true;
      App.VincyProtocol.listHosts(server, function(err, hostlist) {
        server.loading=false;
        server.error = err;
        if (!err) {
          server.parseHostlist(hostlist);
        } else if(err.conError||err.conWarning) {
          self.showEditAccount(server, err);
        }
        self.refreshHostlists();
        self.refreshAccountList();
      });
    });
    //self.refreshAccountList();
  }
  
  function onHostlistItemClick() {
    if (!this || $(this).closest("TR").length==0) return;
    var $tr = $(this).closest("TR");
    $("#contentView tr.active").removeClass("active");
    $tr.addClass("active");
    self.selectedHost = $tr[0].hostInfo;
    self.selectedHostServer = $tr[0].serverInfo;
    console.log(self.selectedHost);
    self.onHostSelected();
  }
  
  self.onHostSelected = function() {
    if(self.selectedHost) $("#tb_hostCommands li").removeClass("disabled");
                else $("#tb_hostCommands li").addClass("disabled");
  }
  
  
  //--> Action Handlers
  
  self.connectToHost = function() {
    connectToHost2(true);
  }
  
  function connectToHost2(isVnc) {
    onHostlistItemClick.apply(this);
    if (!self.selectedHost) return;
    var host=self.selectedHost, id = self.selectedHost.id;
    
    try {
      openModal("modal_connectionList");
      
      if (!host.connection) {
        var firstEstab = true;
        host.connection = App.VincyProtocol.connectHost(self.selectedHostServer, id, isVnc?0x02:0x04, isVnc?null:3398, function(hostId, msg) {
          console.log("connectHost callback:",hostId, msg);
          if (hostId === false) {
            self.showErrMes(msg);
            host.connection = null;
          } else if (msg === true) {
            if (firstEstab )$("#modal_connectionList").foundation("reveal", "close");
            firstEstab = false;
            host.connection.status = "Established";
          } else {
            //self.showErrMes("An error has occured while connecting to "+id+"<br><br>"+msg);
            host.connection.status = msg;
          }
          self.refreshConnectionList();
        });
        self.refreshConnectionList();
      }
      if (isVnc) runVncViewer(host.connection.port); else alert("OK - localhost:"+host.connection.port);
      
    } catch(err) {
      self.showErrMes("An exception has occured while connecting to "+id+"<br><br>"+err+"<br><br><small><pre>"+err.lineNumber+", "+err.fileName+"\n"+err.stack+"</pre></small>");
    }
  }
  
  self.wakeUpHost = function() {
    onHostlistItemClick.apply(this);
    if (!self.selectedHost) return;
    
    var id = self.selectedHost.id;
    
    App.VincyProtocol.wakeOnLan(self.selectedHostServer, id, function(err, ok) {
      if (err) {
        self.showErrMes("An error has occured while waking up "+id+".<br><br>"+err);
      }
    });
  }
  
  self.showHostInfo = function() {
    if (!self.selectedHost) return;
    openModal("modal_hostInfo");
    var $modal = $("#modal_hostInfo");
    var out="";
    for(var key in self.selectedHost) if (key!="comment")
      out += key+": "+self.selectedHost[key]+"<br>";
    $modal.find(".f-info").html(out);
    $modal.find(".f-comment").html(self.selectedHost.comment);
    
  }
  
  
  
  //--> currently open connections
  
  var connectionListitemTemplate = _.template("<tr>\
  <td class=actions><a href='#' class='action f-connect' title='Connect'><i class='fa fa-plane'></i></a> <a href='#' class='action f-closeconn' title='Close connection'><i class='fa fa-close'></i></a> </td>\
  <td><%= host.connection.port %></td><td><%= server.urlViewString() %></td><td><%= host.id %></td><td><%= host.connection.status %></td>\
  </tr>")
  
  self.refreshConnectionList = function() {
    var $tbl = $("#modal_connectionList table tbody").html("");
    App.servers.forEach(function(server) {
      server.hosts.forEach(function(host) {
        if (host.connection) {
          $tbl.append(connectionListitemTemplate({host:host, server:server}));
        }
      })
    })
  }
  
  
  
  
  //--> Helper
  
  function openModal(id, dontTryAgain) {
    try { $("#"+id).foundation("reveal", "open"); }
    catch(ex) { if(!dontTryAgain)setTimeout(function() { openModal(id, true); },700); }
  }
  
  self.showErrMes = function(str) {
    try {
      openModal("modal_error");
      $("#modal_error").find(".f-msg").html(str);
    } catch(ex) {
      alert(str);
    }
  }
  
  App.getUserHome = function() {
    return process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
  }
  
  self.loadConfig = function() {
    App.confDir = App.getUserHome() + "/.config/rs/vincy/";
    try { fs.mkdirSync(App.getUserHome() + "/.config"); fs.mkdirSync(App.getUserHome() + "/.config/rs"); fs.mkdirSync(App.confDir); }catch(Ex){}
    /*
    var serverCert;
    if (fs.existsSync(App.confDir + "server-cert.pem"))
      serverCert = fs.readFileSync(App.confDir + "server-cert.pem");
    else if (fs.existsSync(process.execPath + "server-cert.pem"))
      serverCert = fs.readFileSync(process.execPath + "server-cert.pem");
    else { self.showErrMes("Missing server certificate."); }
    */
    App.config = {};
    try {
      App.config = JSON.parse(fs.readFileSync(App.confDir+"/config.json"));
    } catch(Ex) { self.showErrMes("Could not load configuration file<br><br>"+Ex) }
    
    if (App.config.bookmarks) {
      for(var i in App.config.bookmarks) {
        var server = new App.VincyServer(i, App.config.bookmarks[i]);
        //server.ca = [ serverCert ];
        App.servers.push(server);
      }
    }
    
    if (!App.config.clientKey) {
      var crypt = require('crypto'), buf;
      try {
        buf = crypt.randomBytes(48);
      }catch(ex) {
        buf = crypt.pseudoRandomBytes(48); console.log("WARNING: Pseudo-random bytes were used for clientKey");
        App.config.clientKeyIsPseudorandom = true;
      }
      App.config.clientKey = buf.toString('base64');
      self.storeConfig();
    }
    
    var win = nw.Window.get();
    
    if (App.config.mainWindow) {
      win.x = Math.max(20,parseInt(App.config.mainWindow.x,10));
      win.y = Math.max(20,parseInt(App.config.mainWindow.y,10));
      win.width = Math.max(20,parseInt(App.config.mainWindow.width,10));
      win.height = Math.max(20,parseInt(App.config.mainWindow.height,10));
    }
    win.show();
    
    var out = App.VincyServer.makeJSON(App.servers);
    console.log(out);
  }
  
  self.storeConfig = function() {
    var win = nw.Window.get();
    App.config.mainWindow = { x:win.x, y:win.y, width:win.width, height:win.height };
    App.config.bookmarks = App.VincyServer.makeJSON(App.servers);
    var configString = JSON.stringify(App.config, null, 2);
    fs.writeFileSync(App.confDir+"/config.json", configString);
    
  }
  
})();
