import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link, Switch } from 'react-router-dom';
import './App.css';

class Comment extends Component {
  render() {
    const {author, score, text, last_modified, child_comments} = this.props.comment;
    return (
      <ul>
        <li>
          <div>
            <p>{author} {score} point{score === 1 ? '' : 's'} {last_modified}</p>
            <p>{text}</p>
            {child_comments.map((c, idx) => {
              return <Comment key={idx} comment={c}/>;
            })}
          </div>
        </li>
      </ul>
    );
  }
}

function getHeader(post) {
  let header, postText;
  if (post.is_link) {
    header = (
      <h1>
        <a href={post.link} target="_blank" rel="noopener noreferrer">
          {post.title}
        </a>
        </h1>
    );
    postText = '';
  } else {
    header = (
      <h1>
        <Link to={`/r/${post.subreddit}/${post.slug}/comments`}>
          {post.title}
        </Link>
      </h1>
    );
    postText = <p>{post.text}</p>;
  }
  return [header, postText];
}

class CommentsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  
  componentDidMount() {
    fetch(`http://localhost:8000/r/${this.props.match.params.name}/${this.props.match.params.slug}/comments/`)
      .then(response => {
        if (response.status !== 200) {
          console.warn('uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({post: data.post}));
  }
  
  render() {
    if (!this.state.post) {
      return <div></div>;
    }
    const post = this.state.post;
    let [header, postText] = getHeader(post);
    return (
      <div>
        <Link to={`/r/${post.subreddit}/`}>/r/{post.subreddit}</Link>
        {header}
        {postText}
        <p>{post.score} point{post.score === 1 ? '' : 's'}</p>
        <p>Submitted at {post.created} by {post.author}</p>
        <hr/>
        <p>{post.numComments} comment{post.numComments === 1 ? '' : 's'}</p>
        {post.comments.map((comment, idx) => {
          return <Comment key={idx} comment={comment} />;
        })}
      </div>
    );
  }
}

class Subreddit extends Component {
  constructor(props) {
    super(props);
    this.state = {posts: [], error: false};
  }

  componentDidMount() {
    fetch(`http://localhost:8000/r/${this.props.match.params.name}/`)
      .then(response => {
        if (response.status !== 200) {
          return this.setState({error: true});
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }
  
  render() {
    let posts;
    if (this.state.error) {
      posts = <p>There was an error rendering posts</p>;
    } else if (this.state.posts.length === 0) {
      posts = <p>No posts to show</p>;
    } else {
      posts = this.state.posts.map((post, idx) => {
        return (
          <Post
            post={post}
            key={idx}
          />
        );
      });
    }
    return (
      <div>
        <h1>/r/{this.props.match.params.name}</h1>
        <h2>Posts:</h2>
        <div>
          {posts}
        </div>
      </div>
    );
  }
}

class Post extends Component {
  render() {
    const post = this.props.post;
    let [header, _] = getHeader(post);
    return (
      <div>
        {header}
        <p><Link to={`/r/${post.subreddit}`}>/r/{post.subreddit}</Link></p>
        <p>
          <Link to={`/r/${post.subreddit}/${post.slug}/comments`}>
            {post.numComments} Comment{post.numComments === 1 ? '' : 's'}
          </Link>
        </p>
        <p>Score: {post.score}</p>
      </div>
    );
  }
}

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
      user: undefined,
    };
  }

  componentDidMount() {
    fetch('http://localhost:8000/posts/')
      .then(response => {
        if (response.status !== 200) {
          return console.warn('Uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }
  
  render() {
    return (
      <div>
        <h1>Reddit Clone</h1>
        <p>{this.state.user ? `Logged in as ${this.state.user}` : `Not logged in`}</p>
        {this.state.posts.map((post, idx) => {
          return (
            <Post
              post={post}
              key={idx}
            />
          );
        })}
      </div>
    );
  }
}

class App extends Component {
  render() {
    return (
      <Router>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
          </ul>
        </nav>
        <Route exact path="/" component={Home} />
        <Switch>
          <Route path="/r/:name/:slug/comments" component={CommentsPage}/>
          <Route path="/r/:name" component={Subreddit} />
        </Switch>
      </Router>
    );
  }
}

export default App;
