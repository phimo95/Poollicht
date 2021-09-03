import { Service, PlatformAccessory, CharacteristicValue, CharacteristicGetCallback, CharacteristicSetCallback } from 'homebridge';
// import { PLUGIN_NAME } from './settings';
import { SerialHomebridgePlatform } from './platform';

import Delimiter = require('@serialport/parser-delimiter');

interface Input {
  code: string;
  name: string;
  index: number;
}

/*
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SerialPlatformAccessory {
  private service: Service;
  private inputServices: Service[] = [];
  // private televisionService: Service;
  private tvAccessory;
  // private speakerService: Service;
  private port;
  private parser;
  private muter;
  private maxVolume = 70;
  private minVolume = 0;


  private inputs = {

    '00': 'VCR/DVR',
    '01': 'CBL/SAT',
    '02': 'GAME/TV',
    '03': 'AUX',
    '10': 'BD/DVD',
    '20': 'TAPE',
    '22': 'PHONO',
    '23': 'CD',
    '24': 'FM',
    '25': 'AM',
    '26': 'TUNER',
  };

  private states = {
    powerOn: false,
    volume: 0,
    isMuted:false,
    brightness: 0,
    input: '00', // hex string
    inputs: [] as Input[],
    updates: {
      'SLI': false,
    },
  };

  constructor(
    private readonly platform: SerialHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Philipp')
      .setCharacteristic(this.platform.Characteristic.Model, 'Mohr')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get my port
    // this.platform.log.debug(JSON.stringify(this.platform.connections));
    this.port = this.platform.connections[accessory.context.device.path];

    // create a delimiter parser of 1a
    this.parser = this.port.pipe(new Delimiter({delimiter: [0x1a]}));
    this.parser.on('data', this.handleAnswer.bind(this));

    this.service = this.accessory.getService(this.platform.Service.Television) ||
      this.accessory.addService(this.platform.Service.Television);

 
    this.platform.log.debug('XXXXX:  this.accessory.context.device.displayName');
    this.platform.log.debug('XXXXX: ', this.accessory.context.device.displayName);

  }

  async setOn(state: CharacteristicValue, callback: CharacteristicSetCallback) {
    // implement your own code to turn your device on/off
    this.states.powerOn = state as boolean;

    if (this.states.powerOn) {
      this.platform.log.debug('Turning on...');
      this.sendCmd('PL1');
    } else {
      this.platform.log.debug('Turning off...');
      this.sendCmd('PL0');
    }

    this.platform.log.debug('Set Characteristic On ->', state);
    callback(null);
  }

  /**
   * Handle the 'GET' requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  isOnOff(response) {
    // parses the reponse and says whether it's on or off
    this.platform.log.debug('Processing PWR response');
    // sometimes this returns something besides 00 or 01 (N/A for example)
    if (response === '01') {
      this.states.powerOn=true;
    }
    if (response === '00') {
      this.states.powerOn=false;
    }
    this.platform.log.debug('powerOn set to ', this.states.powerOn);

  }

  getOn(callback: CharacteristicGetCallback) {
    // implement your own code to check if the device is on
    this.sendCmd('PWRQSTN');
    callback(null, this.states.powerOn);
    this.platform.log.debug('Get Characteristic On ->', this.states.powerOn);
  }

  isMuted(response) {
    this.platform.log.debug('Processing MUT response');
    if (response === '01') {
      this.states.isMuted=true;
    }
    if (response === '00') {
      this.states.isMuted=false;
    }
  }

  async getMuted(callback: CharacteristicGetCallback) {
    // check if the device is muted
    const isMuted = this.states.isMuted;
    this.sendCmd('AMTQSTN');
    this.platform.log.debug('Get Characteristic On ->', isMuted);
    callback(null, isMuted);
  }

  async setMuted(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('setMuted entered');
    this.states.isMuted = value as boolean;
    if (this.states.isMuted) {
      this.platform.log.debug('Muting...');
      this.sendCmd('AMT01');
    } else {
      this.platform.log.debug('Unmuting...');
      this.sendCmd('AMT00');
    }
    callback(null);

  }

  async getVolume(callback: CharacteristicGetCallback) {
    this.platform.log.debug('getVolume entered');
    this.sendCmd('MVLQSTN');
    const volume = this.states.volume;
    callback(null, volume);
    this.platform.log.debug('Get Characteristic Volume ->', volume);
    return volume;
  }

  updateVolume(response) {
    // handles packets returned from the volume master volume command
    this.platform.log.debug('handleVolume entered');
    const newVolume = parseInt(response, 16);
    this.platform.log.debug('response: ', newVolume);
    // this should create a percentage between min range / max range
    // e.g. if min is 20 and max is 70, then:
    // 20 + (50 * response / 100)
    // this is the actual volume on the amp
    const pct = (newVolume - this.minVolume) / (this.maxVolume - this.minVolume) * 100;
    // change this to a percent of 20..70
    this.platform.log.debug('pct: ', pct);
    this.states.volume = pct;
    this.platform.log.debug('new volume:', this.states.volume);
  }

  setVolume(newVolume: CharacteristicValue, callback: CharacteristicSetCallback) {
    // applies the configured volume
    // const newVolume = value as number;
    // can only do louder / softer
    /*
    if (direction === 0) {
      // volume up!
      newVolume += 5; // up it by 5%
    } else {
      newVolume -=5;
    }
    */
    newVolume = newVolume as number;
    this.platform.log.debug('newVolume: ', newVolume);
    if (newVolume > 100) {
      newVolume = 100;
    }
    if (newVolume < 0) {
      newVolume = 0;
    }
    this.platform.log.debug('Setting volume to', newVolume, '%');
    this.states.volume = newVolume;
    // calculate percent range
    const realVolume = Math.floor(this.minVolume + ((this.maxVolume - this.minVolume) * newVolume / 100));
    this.platform.log.debug('Setting real volume to', realVolume);
    // convert to hex
    const hexVolume = realVolume.toString(16).toUpperCase();
    this.sendCmd('MVL' + hexVolume);
    callback(null);
  }

  sendCmd(cmd) {
    // sends a command to the receiver
    const rawCmd = '!1' + cmd + '\r';
    this.platform.log.debug('sendCmd', rawCmd);
    this.port.write(rawCmd);
  }

  handleAnswer(data) {
    this.platform.log.debug('handleAnswer entered');
    this.platform.log.debug(data.toString('utf8'));
    const responseCommand = data.slice(2, 5).toString('utf8');
    const responseArgs = data.slice(5, 7).toString('utf8');
    this.platform.log.debug('Response command: %s', responseCommand);
    this.platform.log.debug('Response args: %s', responseArgs);

    switch (responseCommand) {
      case 'PWR':
        this.platform.log.debug('power response');
        this.isOnOff(responseArgs);
        break;
      case 'AMT':
        this.platform.log.debug('muting response');
        this.isMuted(responseArgs);
        break;
      case 'MVL':
        this.updateVolume(responseArgs);
        break;
      case 'SLI':
        this.platform.log.debug('input selector response');
        this.updateInputs(responseArgs);
        break;
      case 'AMX':
        this.platform.log.debug('identify packet response');
        this.platform.log.debug(data);
        break;
    }
  }

  /**
   * Handle 'SET' requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    this.states.brightness = value as number;

    this.platform.log.debug('Set Characteristic Brightness -> ', value);
  }

}
