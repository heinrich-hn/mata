import React, { useEffect, useState } from 'react';

const WialonNotificationComponent: React.FC = () => {
    const [resources, setResources] = useState<wialon.item.Resource[]>([]);
    const [units, setUnits] = useState<wialon.item.Unit[]>([]);
    const [zones, setZones] = useState<wialon.item.Zone[]>([]);
    const [selectedResource, setSelectedResource] = useState<number | null>(null);
    const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
    const [notificationName, setNotificationName] = useState('');
    const [notificationType, setNotificationType] = useState(''); // Default notification type if needed
    const [logMessages, setLogMessages] = useState<string[]>([]);

    // Print messages to the log
    const msg = (text: string) => {
        setLogMessages((prev) => [text, ...prev]);
    };

    const init = () => {
        const sess = wialon.core.Session.getInstance();
        const flagsRes = wialon.item.Item.dataFlag.base | wialon.item.Resource.dataFlag.zones;
        const flagsUnits = wialon.item.Item.dataFlag.base;

        sess.loadLibrary("resourceZones");
        sess.loadLibrary("resourceNotifications");
        sess.updateDataFlags(
            [
                { type: "type", data: "avl_resource", flags: flagsRes, mode: 0 },
                { type: "type", data: "avl_unit", flags: flagsUnits, mode: 0 }
            ],
            (code) => {
                if (code) {
                    msg(wialon.core.Errors.getErrorText(code));
                    return;
                }

                const res = wialon.util.Helper.filterItems(
                    sess.getItems("avl_resource"),
                    wialon.item.Resource.accessFlag.editNotifications
                ) as wialon.item.Resource[];
                setResources(res);

                const unitsLoaded = sess.getItems("avl_unit") as wialon.item.Unit[];
                setUnits(unitsLoaded);
                selectResource(res[0]?.getId()); // Select the first resource by default
            }
        );
    };

    const selectResource = (resourceId: number | null) => {
        if (resourceId) {
            setSelectedResource(resourceId);
            getZones(resourceId);
        }
    };

    const getZones = (resId: number) => {
        const res = wialon.core.Session.getInstance().getItem(resId) as wialon.item.Resource;
        const zonesLoaded = res.getZones() as wialon.item.Zone[];
        setZones(zonesLoaded);
    };

    const createNotification = () => {
        const res = wialon.core.Session.getInstance().getItem(selectedResource!) as wialon.item.Resource;
        if (!res) {
            msg("Unknown resource");
            return;
        }

        const ids = zones.filter(zone => zone.selected).map(zone => zone.id);
        const un = selectedUnits;
        const name = notificationName;
        const type = notificationType;
        const from = wialon.core.Session.getInstance().getServerTime();
        const to = from + 3600 * 24 * 7;

        if (!un.length) { msg("Select units"); return; }
        if (!ids.length) { msg("Select geofences"); return; }

        const obj = {
            ma: 0,
            fl: 1,
            tz: 10800,
            la: "en",
            act: [{ t: "message", p: {} }],
            sch: { f1: 0, f2: 0, t1: 0, t2: 0, m: 0, y: 0, w: 0 },
            txt: "Test Notification Text",
            mmtd: 3600,
            cdt: 10,
            mast: 0,
            mpst: 0,
            cp: 3600,
            n: name,
            un: un,
            ta: from,
            td: to,
            trg: {
                t: "geozone",
                p: { geozone_ids: ids.join(), type }
            }
        };

        res.createNotification(obj, (code) => {
            if (code) { msg(wialon.core.Errors.getErrorText(code)); return; }
            msg("Notification created successfully");
            setNotificationName('');
            setZones([]); // Clear zones if needed
            setSelectedUnits([]);
        });
    };

    useEffect(() => {
        wialon.core.Session.getInstance().initSession("https://hst-api.wialon.com");
        wialon.core.Session.getInstance().loginToken("your-token-here", "", (code) => {
            if (code) { msg(wialon.core.Errors.getErrorText(code)); return; }
            msg("Logged successfully");
            init();
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div>
            <h1>Wialon Notification Creator</h1>
            <div>
                <label htmlFor="res">Select Resource:</label>
                <select id="res" onChange={(e) => selectResource(Number(e.target.value))}>
                    <option value="">Select a resource</option>
                    {resources.map(res => (
                        <option key={res.getId()} value={res.getId()}>
                            {res.getName()}
                        </option>
                    ))}
                </select>

                <label htmlFor="zones">Select Zones:</label>
                <select id="zones" multiple>
                    {zones.map(zone => (
                        <option key={zone.id} value={zone.id}>
                            {zone.n}
                        </option>
                    ))}
                </select>

                <label htmlFor="units">Select Units:</label>
                <select id="units" multiple onChange={(e) => {
                    const selectedValues = Array.from(e.target.selectedOptions).map(option => Number(option.value));
                    setSelectedUnits(selectedValues);
                }}>
                    {units.map(unit => (
                        <option key={unit.getId()} value={unit.getId()}>
                            {unit.getName()}
                        </option>
                    ))}
                </select>

                <input
                    type="text"
                    id="notif_name"
                    value={notificationName}
                    onChange={(e) => setNotificationName(e.target.value)}
                    placeholder="Enter notification name"
                />

                <label htmlFor="type">Select Notification Type:</label>
                <select id="type" onChange={(e) => setNotificationType(e.target.value)}>
                    <option value="entry">Entry</option>
                    <option value="exit">Exit</option>
                </select>

                <button id="create_btn" onClick={createNotification}>Create Notification</button>
            </div>

            <div id="log">
                <h2>Log Messages</h2>
                {logMessages.map((message, index) => (
                    <div key={index}>{message}</div>
                ))}
            </div>
        </div>
    );
};

export default WialonNotificationComponent;
