"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = require("async");
const user = require("../../user");
const topics = require("../../topics");
const categories = require("../../categories");
const privileges = require("../../privileges");
const socketHelpers = require("../helpers");
const events = require("../../events");
module.exports = function (SocketTopics) {
    SocketTopics.move = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !Array.isArray(data.tids) || !data.cid) {
                throw new Error('[[error:invalid-data]]');
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const canMove = yield privileges.categories.isAdminOrMod(data.cid, socket.uid);
            if (!canMove) {
                throw new Error('[[error:no-privileges]]');
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const uids = yield user.getUidsFromSet('users:online', 0, -1);
            yield async.eachLimit(data.tids, 10, (tid) => {
                (() => __awaiter(this, void 0, void 0, function* () {
                    const canMove = yield privileges.topics.isAdminOrMod(tid, socket.uid);
                    if (!canMove) {
                        throw new Error('[[error:no-privileges]]');
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                    const topicData = yield topics.getTopicFields(tid, ['tid', 'cid', 'slug', 'deleted']);
                    data.uid = socket.uid;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                    yield topics.tools.move(tid, data);
                    const notifyUids = yield privileges.categories.filterUids('topics:read', topicData.cid, uids);
                    socketHelpers.emitToUids('event:topic_moved', topicData, notifyUids);
                    if (!topicData.deleted) {
                        socketHelpers.sendNotificationToTopicOwner(tid, socket.uid, 'move', 'notifications:moved_your_topic');
                    }
                    yield events.log({
                        type: `topic-move`,
                        uid: socket.uid,
                        ip: socket.ip,
                        tid: tid,
                        fromCid: topicData.cid,
                        toCid: data.cid,
                    });
                }))().catch(e => console.error(e));
            });
        });
    };
    SocketTopics.moveAll = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.cid || !data.currentCid) {
                throw new Error('[[error:invalid-data]]');
            }
            const canMove = yield privileges.categories.canMoveAllTopics(data.currentCid, data.cid, socket.uid);
            if (!canMove) {
                throw new Error('[[error:no-privileges]]');
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tids = yield categories.getAllTopicIds(data.currentCid, 0, -1);
            data.uid = socket.uid;
            yield async.eachLimit(tids, 50, (tid) => {
                (() => __awaiter(this, void 0, void 0, function* () {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                    yield topics.tools.move(tid, data);
                }))().catch(e => console.error(e));
            });
            yield events.log({
                type: `topic-move-all`,
                uid: socket.uid,
                ip: socket.ip,
                fromCid: data.currentCid,
                toCid: data.cid,
            });
        });
    };
};
