// src/components/map/MeasurementControl.tsx
import L from 'leaflet';
import 'leaflet-measure';
import 'leaflet-measure/dist/leaflet-measure.css';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Extend Leaflet's control factory to include the measure control
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace L {
    namespace Control {
      interface ControlOptions {
        measure?: never; // placeholder – actual options are defined below
      }
    }

    // Properly type the measure control factory
    interface Control {
      measure: (options?: {
        position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
        primaryLengthUnit?: 'meters' | 'kilometers' | 'feet' | 'miles';
        secondaryLengthUnit?: 'meters' | 'kilometers' | 'feet' | 'miles';
        primaryAreaUnit?: 'sqmeters' | 'hectares' | 'acres' | 'sqfeet';
        secondaryAreaUnit?: 'sqmeters' | 'hectares' | 'acres' | 'sqfeet';
        activeColor?: string;
        completedColor?: string;
        popupOptions?: {
          className?: string;
          autoPanPadding?: [number, number];
        };
      }) => L.Control;
    }
  }
}

export function MeasurementControl() {
  const map = useMap();

  useEffect(() => {
    // Create measurement control
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const measureControl = (L.control as any).measure({
      position: 'topleft',
      primaryLengthUnit: 'kilometers',
      secondaryLengthUnit: 'meters',
      primaryAreaUnit: 'sqmeters',
      secondaryAreaUnit: 'hectares',
      activeColor: '#ff0000',
      completedColor: '#00ff00',
      popupOptions: {
        className: 'leaflet-measure-popup',
        autoPanPadding: [10, 10] as [number, number],
      },
    });

    measureControl.addTo(map);

    // Cleanup on unmount
    return () => {
      map.removeControl(measureControl);
    };
  }, [map]);

  // This component renders nothing (it just adds a control to the map)
  return null;
}