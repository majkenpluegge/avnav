#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################

import time
import subprocess
import threading
import os
import datetime
import glob
import sys
import traceback
import json

from avnav_util import *
from avnav_worker import *
from wpa_control import WpaControl

#a handler to set up a wpa claient
class AVNWpaHandler(AVNWorker):
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.wpaHandler=None
  @classmethod
  def getConfigName(cls):
    return "AVNWpaHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'ownSocket':'/tmp/avnav-wpa-ctrl', #my own socket endpoint
            'wpaSocket':"/var/run/wpa_supplicant/wlan-av1", #the wpa control socket
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNWpaHandler(cfgparam)
  def getName(self):
    return "WpaControl"

  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    wpaSocket=self.getStringParam('wpaSocket')
    ownSocket=self.getStringParam('ownSocket')
    while True:
      try:
        newWpaSocket=self.getStringParam('wpaSocket')
        if newWpaSocket != wpaSocket:
          if self.wpaHandler is not None:
            self.wpaHandler.close(False)
            self.wpaHandler=None
          wpaSocket=newWpaSocket
        if os.path.exists(wpaSocket):
          if self.wpaHandler is None:
            AVNLog.info("connecting to wpa_supplicant %s",wpaSocket)
            self.wpaHandler=WpaControl(wpaSocket,ownSocket)
            self.wpaHandler.open()
            self.setInfo('main','connected to %s'%(wpaSocket),AVNWorker.Status.STARTED)
        else:
          if self.wpaHandler is not None:
            self.wpaHandler.close(False)
            self.wpaHandler=None
            AVNLog.info("disconnecting from wpa_supplicant %s",wpaSocket)
            self.setInfo('main','disconnected from %s'%(wpaSocket),AVNWorker.Status.INACTIVE)
          time.sleep(5)
          continue
        #we should have an active wpa handler here...
        #todo: cache scan results here
      except Exception as e:
        AVNLog.error("exception in WPAHandler: %s",traceback.format_exc())
        pass
      time.sleep(5)
      

  def getList(self):
    rt=[]
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      wpaHandler.startScan()
    except:
      AVNLog.error("exception in WPAHandler:getList: %s",traceback.format_exc())
    try:
      rt=wpaHandler.scanResultWithInfo()
      AVNLog.debug("wpa list",rt)
      return rt
    except Exception:
      AVNLog.error("exception in WPAHandler:getList: %s",traceback.format_exc())
      return rt
  def removeNetwork(self,id):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa remove network",id)
      wpaHandler.removeNetwork(id)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:getList: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}

  def enableNetwork(self,id):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa enable network",id)
      wpaHandler.enableNetwork(id)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:getList: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}
  def disableNetwork(self,id):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa disable network",id)
      wpaHandler.disableNetwork(id)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:disableNetwork: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}

  def connect(self,param):
    rt={'status':'no WLAN'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      AVNLog.debug("wpa connect",param)
      wpaHandler.connect(param)
      wpaHandler.saveConfig()
      return {'status':'OK'}
    except Exception as e:
      AVNLog.error("exception in WPAHandler:connect: %s",traceback.format_exc())
      return {'status':'commandError','info':str(e)}

  def getStatus(self):
    rt={'wpa_state':'OFFLINE'}
    wpaHandler=self.wpaHandler
    if wpaHandler is None:
      return rt
    try:
      rt=wpaHandler.status()
      AVNLog.debug("wpa status",rt)
      return rt
    except Exception:
      AVNLog.error("exception in WPAHandler:getStatus: %s",traceback.format_exc())
      return {'wpa_state','COMMANDERROR'}

  #get a HTTP request param
  def getRequestParam(self,requestparam,name):
    rt=requestparam.get(name)
    if rt is None:
      return None
    if isinstance(rt,list):
      return rt[0].decode('utf-8',errors='ignore')
    return rt
  def handleWpaRequest(self,requestparam):
    command=self.getRequestParam(requestparam, 'command')
    rt=None
    if command is None:
      raise Exception('missing command for wpa request')
    if command == 'list':
      rt=json.dumps(self.getList())
    if command == 'status':
      rt=json.dumps(self.getStatus())
    if command == 'all':
      rt=json.dumps({'status':self.getStatus(),'list':self.getList()})
    if command == 'enable':
      id=self.getRequestParam(requestparam,'id')
      rt=json.dumps(self.enableNetwork(id))
    if command == 'disable':
      id=self.getRequestParam(requestparam,'id')
      rt=json.dumps(self.disableNetwork(id))
    if command == 'remove':
      id=self.getRequestParam(requestparam,'id')
      rt=json.dumps(self.removeNetwork(id))
    if command == 'connect':
      param={}
      for k in ['ssid','psk']:
        v=self.getRequestParam(requestparam,k)
        if v is not None:
          param[k]=v
      rt=json.dumps(self.connect(param))
    if rt is None:
      raise Exception("unknown command %s"%(command))
    return rt

        