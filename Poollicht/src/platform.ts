import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SerialPlatformAccessory } from './platformAccessory';

import SerialPort = require ('serialport');

interface SerialDevice {
  path: string;
  displayName: string;
}

/**
 * OnkyoSerialHomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */

export class SerialHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private baudRate = 9600;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public connections = {};

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.config = config;
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    this.log.debug('discoverDevices entered...');
    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.
    let serialDevices = [] as SerialDevice[];

   
      serialDevices = [
        {
          path: '/dev/ttyS0',
          displayName: 'Onkyo AVR',
        },
      ];
    

    this.log.debug('serialDevices: ', serialDevices);

    /*
       I'd like to be able to use this, but it's a Promise and I
       don't now how that works...
    */
    // const serialDevices = SerialPort.list();
    // this.log.debug(serialDevices);

    for (const device of serialDevices) {
      // generate a UUID for this connection
      const uuid = this.api.hap.uuid.generate(device.path);
      this.log.debug('Using uuid %s', uuid);
      this.connections[device.path] = SerialPort(device.path, {
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        lock: true,
        autoOpen: true,
      });

      // check if this is an existing accessory
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // create the accessory handler for the restored accessory
        new SerialPlatformAccessory(this, existingAccessory);
      } else {
        // new accessory
        this.log.info('Adding new accessory', device.displayName);
        const accessory = new this.api.platformAccessory(device.displayName,
          uuid,
          this.api.hap.Categories.AUDIO_RECEIVER);
        // store a copy o the object in the accessory.context
        // the context property can be used to store any data
        // about the accessory you may need
        accessory.context.device = device;

        new SerialPlatformAccessory(this, accessory);

        // link the accessory to the platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log.info(PLUGIN_NAME, PLATFORM_NAME);
      }
    }
  }
}
