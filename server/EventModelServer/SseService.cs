using System.Collections.Concurrent;
using System.Threading.Channels;

namespace EventModelServer;

public class SseService
{
    private readonly ConcurrentDictionary<Channel<(string evt, string data)>, byte> _clients = new();

    public Channel<(string evt, string data)> Subscribe()
    {
        var channel = Channel.CreateUnbounded<(string, string)>();
        _clients.TryAdd(channel, 0);
        return channel;
    }

    public void Unsubscribe(Channel<(string evt, string data)> channel)
    {
        _clients.TryRemove(channel, out _);
        channel.Writer.TryComplete();
    }

    public void Broadcast(string eventName, string data)
    {
        foreach (var (channel, _) in _clients)
            channel.Writer.TryWrite((eventName, data));
    }

    public int ClientCount => _clients.Count;
}
