
.PHONY:	run-osx

VERSION := $(shell awk -F '"' '$$2=="version"{print $$4}' App/package.json)
TARGETDIR = ./Build/vincy-client-$(PLATFORM)-$(VERSION)

run-osx:
	NO_UPDATE=true ./BuildResources/nw-osx-x64/node-webkit.app/Contents/MacOS/node-webkit ./App/

run-linux:
	NO_UPDATE=true ./BuildResources/nw-linux-x64/nw ./App


build-win32:
	$(eval PLATFORM=win32)
	@echo "Running $(PLATFORM) Build $(VERSION)"
	@echo "------------------------------------"


	rm -rf $(TARGETDIR)
	mkdir -p $(TARGETDIR)
	cp -r ./BuildResources/nw-win-ia32/* "$(TARGETDIR)/"
	#cat ./Build/Win32/nw.exe ./Build/ViNCy-ng.nw > ./Build/Win32/ViNCy-ng.exe
	#rm ./Build/Win32/nw.exe
	mv $(TARGETDIR)/nw.exe $(TARGETDIR)/ViNCy-ng.exe
	#cp ./Build/ViNCy-ng.nw ./Build/Win32/app.nw
	cp -r ./App/* $(TARGETDIR)/
	rm $(TARGETDIR)/nwsnapshot.exe
	wine BuildResources/Resourcer.exe -op:upd -src:"$(TARGETDIR)/ViNCy-ng.exe" -type:icon -name:IDR_MAINFRAME -lang:1033 -file:App/style/AppIcon.ico 2>/dev/null

	cd Build; zip -r vincy-client-win32-$(VERSION).zip vincy-client-win32-$(VERSION)
	#cd Build; 7z a -sfx"$(shell pwd)/BuildResources/7z.sfx" vincy-client-win32-$(VERSION).exe vincy-client-win32-$(VERSION)


build-linux:
	$(eval PLATFORM=linux64)
	@echo "Running $(PLATFORM) Build $(VERSION)"
	@echo "------------------------------------"


	rm -rf $(TARGETDIR)
	mkdir -p $(TARGETDIR)
	cp -r ./BuildResources/nw-linux-x64/* "$(TARGETDIR)/"
	mv $(TARGETDIR)/nw $(TARGETDIR)/vincy-client
	cp -r ./App/* $(TARGETDIR)/

	cd Build; tar czf "vincy-client-linux64-$(VERSION).tar.gz" vincy-client-linux64-$(VERSION)


build-osx:
	$(eval PLATFORM=darwin)
	@echo "Running $(PLATFORM) Build $(VERSION)"
	@echo "------------------------------------"

	rm -rf $(TARGETDIR)
	mkdir -p $(TARGETDIR)
	cp -r "./BuildResources/nw-osx-x64/node-webkit.app" "$(TARGETDIR)/ViNCy-ng.app"
	cp -r "./App" "$(TARGETDIR)/ViNCy-ng.app/Contents/Resources/app.nw"
	cd $(TARGETDIR); zip -r vincy-client-mac-os-x-$(VERSION).zip ViNCy-ng.app; mv *.zip ..

build-update:
	$(eval PLATFORM=update)
	rm -rf $(TARGETDIR)
	mkdir -p $(TARGETDIR)
	cp -r ./App/* $(TARGETDIR)/
	cd $(TARGETDIR); zip -r vincy-client-update-$(VERSION).zip .; mv *.zip ..


build: build-win32 build-osx build-linux build-update

clean:
	rm -rf ./Build/vincy-client*


upload:
	scp ./Build/vincy-client-*-*.*.*.* cherry:/srv/hosts/max-weller.de/downloads.max-weller.de/vincy-client/
