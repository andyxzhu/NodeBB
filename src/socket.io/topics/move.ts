import async = require('async');
import user = require('../../user');
import topics = require('../../topics');
import categories = require('../../categories');
import privileges = require('../../privileges');
import socketHelpers = require('../helpers');
import events = require('../../events');

type SocketTopic = {
    move: (socket: socketType, data: dataType) => Promise<void>;
    moveAll: (socket: socketType, data: dataType) => Promise<void>;
}

type dataType = {
    tids?: string[];
    uid?: string;
    cid?: string;
    currentCid?: string;
};

type socketType = {
    uid?: string;
    ip?: string;
};

type topicType = {
    cid?: string;
    deleted?: boolean;
};

module.exports = function (SocketTopics: SocketTopic) {
    SocketTopics.move = async function (socket: socketType, data: dataType): Promise<void> {
        if (!data || !Array.isArray(data.tids) || !data.cid) {
            throw new Error('[[error:invalid-data]]');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const canMove: boolean = await privileges.categories.isAdminOrMod(data.cid, socket.uid) as boolean;
        if (!canMove) {
            throw new Error('[[error:no-privileges]]');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids: string[] = await user.getUidsFromSet('users:online', 0, -1) as string[];

        await async.eachLimit(data.tids, 10, (tid: string) => {
            (async () => {
                const canMove: boolean = await privileges.topics.isAdminOrMod(tid, socket.uid) as boolean;
                if (!canMove) {
                    throw new Error('[[error:no-privileges]]');
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                const topicData: topicType = await topics.getTopicFields(tid, ['tid', 'cid', 'slug', 'deleted']) as topicType;
                data.uid = socket.uid;

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                await topics.tools.move(tid, data);

                const notifyUids: string[] = await privileges.categories.filterUids('topics:read',
                    topicData.cid,
                    uids) as string[];
                socketHelpers.emitToUids('event:topic_moved', topicData, notifyUids) as void;
                if (!topicData.deleted) {
                    socketHelpers.sendNotificationToTopicOwner(tid,
                        socket.uid,
                        'move',
                        'notifications:moved_your_topic') as void;
                }

                await events.log({
                    type: `topic-move`,
                    uid: socket.uid,
                    ip: socket.ip,
                    tid: tid,
                    fromCid: topicData.cid,
                    toCid: data.cid,
                });
            })().catch(e => console.error(e));
        });
    };


    SocketTopics.moveAll = async function (socket: socketType, data: dataType): Promise<void> {
        if (!data || !data.cid || !data.currentCid) {
            throw new Error('[[error:invalid-data]]');
        }
        const canMove: boolean = await privileges.categories.canMoveAllTopics(data.currentCid,
            data.cid,
            socket.uid) as boolean;

        if (!canMove) {
            throw new Error('[[error:no-privileges]]');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tids: string[] = await categories.getAllTopicIds(data.currentCid, 0, -1) as string[];
        data.uid = socket.uid;
        await async.eachLimit(tids, 50, (tid: string) => {
            (async () => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                await topics.tools.move(tid, data);
            })().catch(e => console.error(e));
        });
        await events.log({
            type: `topic-move-all`,
            uid: socket.uid,
            ip: socket.ip,
            fromCid: data.currentCid,
            toCid: data.cid,
        });
    };
};
