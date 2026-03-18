/**
 * Wialon JavaScript SDK Type Declarations
 * For the global wialon object loaded via script tag
 */

declare namespace wialon {
  namespace core {
    class Session {
      static getInstance(): Session;
      initSession(baseUrl: string): void;
      loginToken(token: string, operateAs: string, callback: (code: number) => void): void;
      loadLibrary(libraryName: string): void;
      updateDataFlags(
        specs: Array<{ type: string; data: string; flags: number; mode: number }>,
        callback: (code: number) => void
      ): void;
      getItems(itemType: string): item.Item[];
      getItem(itemId: number): item.Item | null;
      getServerTime(): number;
      logout(callback?: (code: number) => void): void;
    }

    class Errors {
      static getErrorText(code: number): string;
    }
  }

  namespace item {
    class Item {
      static dataFlag: {
        base: number;
        customFields: number;
        customProps: number;
        billingProps: number;
        image: number;
        messages: number;
        guid: number;
        lastMessage: number;
      };
      getId(): number;
      getName(): string;
    }

    interface Resource extends Item {
      getZones(): Zone[];
      createNotification(
        notification: NotificationConfig,
        callback: (code: number) => void
      ): void;
    }

    namespace Resource {
      const dataFlag: {
        zones: number;
        zoneGroups: number;
        poi: number;
        poiGroups: number;
        notifications: number;
        jobs: number;
        drivers: number;
        trailers: number;
        accounts: number;
      };
      const accessFlag: {
        editNotifications: number;
        viewNotifications: number;
        editDrivers: number;
        editTrailers: number;
        editPoi: number;
        editZones: number;
        editJobs: number;
      };
    }

    interface Unit extends Item {
      getSensors(): Sensor[];
      getLastMessage(): Message | null;
      calculateSensorValue(sensor: Sensor, message: Message): number;
    }

    interface Zone {
      id: number;
      n: string;
      selected?: boolean;
    }

    interface Sensor {
      id: string;
      n: string;
      t: string;
      m: string;
      p: string;
      d?: string;
    }

    interface Message {
      t: number;
      pos?: {
        x: number;
        y: number;
        s: number;
        c: number;
      };
      p: Record<string, unknown>;
    }

    interface NotificationConfig {
      n: string;
      un: number[];
      ma: number;
      fl: number;
      tz: number;
      la: string;
      act: Array<{ t: string; p: Record<string, unknown> }>;
      sch: {
        f1: number;
        f2: number;
        t1: number;
        t2: number;
        m: number;
        y: number;
        w: number;
      };
      txt: string;
      mmtd: number;
      cdt: number;
      mast: number;
      mpst: number;
      cp: number;
      ta: number;
      td: number;
      trg: {
        t: string;
        p: Record<string, unknown>;
      };
    }
  }

  namespace util {
    class Helper {
      static filterItems(items: item.Item[], accessFlag: number): item.Item[];
    }
  }
}